import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
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

    const pendingRef = adminDb.collection("pendingSignups").doc(session.id);
    const pendingSnap = await pendingRef.get();

    if (!pendingSnap.exists) {
      console.warn("⚠️ No pending signup for session", session.id);
      return NextResponse.json({ received: true });
    }

    const pending = pendingSnap.data()!;
    const { email, name, orgName, phone, plan } = pending;

    const existingUser = await adminAuth
      .getUserByEmail(email)
      .catch(() => null);

    if (existingUser) {
      console.log("ℹ️ User already exists:", email);
      return NextResponse.json({ received: true });
    }

    const normalizedPlan = normalizePlan(plan);

    const userRecord = await adminAuth.createUser({
      email,
      displayName: name,
    });

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
    });

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

    await pendingRef.delete();
  }

  // =========================================================================
  // SUBSCRIPTION UPDATED → KEEP PLAN & ACTIVE STATUS IN SYNC
  // =========================================================================
  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;

    const nickname =
      sub.items.data[0].price.nickname ||
      sub.items.data[0].price.product ||
      "";

    const cleanPlan = normalizePlan(nickname);
    const customerId = sub.customer as string;

    const orgSnap = await adminDb
      .collection("organizations")
      .where("stripeCustomerId", "==", customerId)
      .limit(1)
      .get();

    if (!orgSnap.empty) {
      await orgSnap.docs[0].ref.update({
        plan: cleanPlan,
        active: true,
        stripeSubscriptionId: sub.id,
      });

      console.log("✅ Subscription updated → plan:", cleanPlan);
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
      await orgSnap.docs[0].ref.update({
        active: false,
        canceledAt: Timestamp.now(),
        stripeSubscriptionId: null,
      });

      console.log("❌ Subscription canceled — org deactivated");
    } else {
      console.warn("⚠️ No org found for canceled subscription");
    }
  }

  return NextResponse.json({ received: true });
}
