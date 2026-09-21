import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb, adminAuth } from "@/lib/auth/server";
import { Timestamp } from "@/lib/data/server";
import crypto from "crypto";
import { sendEmail } from "@/lib/email";
import { buildPasswordSetupEmail } from "@/lib/emailTemplates";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe not configured");
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// -------------------------
// PLAN NORMALIZER
// -------------------------
function normalizePlan(
  value: string | Stripe.Product | Stripe.DeletedProduct | null | undefined
): "basic" | "pro" | "premium" | "enterprise" {
  const v = String(value || "").toLowerCase();

  if (v.includes("enterprise")) return "enterprise";
  if (v.includes("premium")) return "premium";
  if (v.includes("pro")) return "pro";
  return "basic";
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("🔔 Stripe event received:", event.type);

  // =========================================================================
  // CHECKOUT COMPLETED → CREATE USER + ORG
  // =========================================================================
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Recovery pays for the existing workspace; never create another user/org.
    const recoveryOrg = session.metadata?.restok_recovery_org;
    if (recoveryOrg) {
      const ref = adminDb.collection("organizations").doc(recoveryOrg);
      const org = (await ref.get()).data();
      if (!org || org.stripeCustomerId !== session.customer || typeof session.subscription !== "string") {
        return NextResponse.json({ error: "Recovery workspace mismatch" }, { status: 400 });
      }
      const subscription = await getStripe().subscriptions.retrieve(session.subscription);
      if (["active", "trialing", "past_due"].includes(subscription.status)) {
        await ref.update({ active: true, stripeSubscriptionId: subscription.id,
          canceledAt: null, scheduledDeletionAt: null });
      }
      return NextResponse.json({ received: true });
    }

    const pendingRef = adminDb.collection("pendingSignups").doc(session.id);
    const pendingSnap = await pendingRef.get();

    if (!pendingSnap.exists) {
      console.warn("⚠️ No pending signup for session", session.id);
      return NextResponse.json({ received: true });
    }

    const pending = pendingSnap.data()!;
    const { email, name, orgName, phone, plan, googleUid } = pending;

    let userRecord;

    if (googleUid) {
      userRecord = await adminAuth.getUser(googleUid).catch(() => null);

      if (!userRecord) {
        console.warn("⚠️ Google signup user missing:", googleUid);
        return NextResponse.json({ received: true });
      }
    } else {
      const existingUser = await adminAuth
        .getUserByEmail(email)
        .catch(() => null);

      if (existingUser) {
        console.log("ℹ️ User already exists:", email);
        return NextResponse.json({ received: true });
      }

      userRecord = await adminAuth.createUser({
        email,
        displayName: name,
      });
    }

    const normalizedPlan = normalizePlan(plan);

    const orgId = userRecord.uid;

    await adminDb.collection("organizations").doc(orgId).set({
      name: orgName || name || "My Organization",
      ownerId: orgId,
      orgId,
      plan: normalizedPlan,
      active: true,
      stripeCustomerId: session.customer ?? null,
      stripeSubscriptionId: session.subscription ?? null,
      createdAt: Timestamp.now(),
    });

    await adminDb.collection("users").doc(orgId).set({
      name,
      email,
      phone: phone || "",
      orgId,
      role: "owner",
      createdAt: Timestamp.now(),
      authProvider: googleUid ? "google.com" : "password",
    }, { merge: true });

    if (!googleUid) {
      const token = crypto.randomBytes(32).toString("hex");

      await adminDb.collection("passwordSetupTokens").doc(token).set({
        uid: orgId,
        email,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(
          new Date(Date.now() + 1000 * 60 * 60 * 24)
        ),
      });

      const setupUrl = `https://getrestok.com/set-password?token=${token}`;

      const message = buildPasswordSetupEmail({
        recipientName: name,
        setupUrl,
        orgName: orgName || name || "My Organization",
      });

      await sendEmail({
        from: "Restok <accounts@getrestok.com>",
        to: email,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
    }

    await pendingRef.delete();
  }

  // =========================================================================
  // SUBSCRIPTION UPDATED → KEEP PLAN & ACTIVE STATUS IN SYNC
  // =========================================================================
  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.created"
  ) {
    // Fetch current state so delayed webhook deliveries cannot replay stale status.
    const sub = await getStripe().subscriptions.retrieve((event.data.object as Stripe.Subscription).id);

    const nickname =
      sub.items.data[0].price.nickname ||
      sub.items.data[0].price.product ||
      "";

    const priceId = sub.items.data[0].price.id;
    const configuredPlan = (["basic", "pro", "premium"] as const).find(plan =>
      ["MONTHLY", "YEARLY"].some(interval =>
        process.env[`STRIPE_${interval}_${plan.toUpperCase()}_PRICE_ID`] === priceId));
    const recoveryPlan = sub.metadata?.restok_price === priceId ? sub.metadata.restok_plan : undefined;
    const cleanPlan = configuredPlan || normalizePlan(recoveryPlan || nickname);
    const customerId = sub.customer as string;

    // Keep access while a payment is still being retried (past_due); only a
    // dead subscription (unpaid/paused/canceled/incomplete_expired) deactivates.
    const ACTIVE_STATUSES = ["active", "trialing", "past_due"];
    const isActive = ACTIVE_STATUSES.includes(sub.status);

    const orgSnap = await adminDb
      .collection("organizations")
      .where("stripeCustomerId", "==", customerId)
      .limit(1)
      .get();

    if (!orgSnap.empty) {
      const orgRef = orgSnap.docs[0].ref;
      const currentId = orgSnap.docs[0].data().stripeSubscriptionId;
      if (currentId && currentId !== sub.id) {
        const current = await getStripe().subscriptions.retrieve(currentId);
        if (!["canceled", "incomplete_expired"].includes(current.status)) {
          return NextResponse.json({ received: true });
        }
      }
      if (isActive) {
        // Reactivating (incl. resubscribing from the billing portal) restores
        // access and clears any pending data-retention deletion deadline.
        await orgRef.update({
          plan: cleanPlan,
          active: true,
          stripeSubscriptionId: sub.id,
          canceledAt: null,
          scheduledDeletionAt: null,
        });
        console.log("✅ Subscription active → plan:", cleanPlan, `(${sub.status})`);
      } else {
        // Access is paused; no automatic data-deletion policy is scheduled.
        const existing = orgSnap.docs[0].data();
        await orgRef.update({
          plan: cleanPlan,
          active: false,
          stripeSubscriptionId: sub.id,
          canceledAt: existing.canceledAt ?? Timestamp.now(),
          scheduledDeletionAt: null,
        });
        console.log("⚠️ Subscription inactive → deactivated:", sub.status);
      }
    }
  }

  // =========================================================================
  // SUBSCRIPTION CANCELED → DEACTIVATE ACCOUNT
  // =========================================================================
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = sub.customer as string;

    const orgSnap = await adminDb
      .collection("organizations")
      .where("stripeCustomerId", "==", customerId)
      .limit(1)
      .get();

    if (!orgSnap.empty) {
      // Ignore cancellation of an older subscription after the org resubscribed.
      const currentId = orgSnap.docs[0].data().stripeSubscriptionId;
      if (currentId && currentId !== sub.id) return NextResponse.json({ received: true });
      await orgSnap.docs[0].ref.update({
        active: false,
        canceledAt: Timestamp.now(),
        scheduledDeletionAt: null,
        stripeSubscriptionId: null,
      });

      console.log("❌ Subscription canceled — org deactivated");
    } else {
      console.warn("⚠️ No org found for canceled subscription");
    }
  }

  return NextResponse.json({ received: true });
}
