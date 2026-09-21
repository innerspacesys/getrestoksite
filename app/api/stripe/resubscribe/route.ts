import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/auth/server";
import { ApiError, apiError } from "@/lib/apiAuth";

export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new ApiError("Please sign in again.", 401);
    const decoded = await adminAuth.verifyIdToken(token, true)
      .catch(() => { throw new ApiError("Please sign in again.", 401); });
    const caller = (await adminDb.collection("users").doc(decoded.uid).get()).data();
    if (!caller?.orgId || caller.disabled || caller.accountStatus === "deactivated" ||
        !["owner", "admin"].includes(caller.role)) {
      throw new ApiError("Only active owners and admins can manage billing.", 403);
    }
    if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe not configured");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const orgId = caller.orgId as string;
    // Serialize attempts for this workspace, including different owners/admins.
    const url = await adminDb.runTransaction(async tx => {
      const org = (await tx.get(adminDb.collection("organizations").doc(orgId))).data();
      if (!org?.stripeCustomerId) throw new ApiError("Please contact support to restore billing for this workspace.", 409);
      const customer = org.stripeCustomerId as string;
      const subscriptions = await stripe.subscriptions.list({ customer, status: "all", limit: 100 });
      if (subscriptions.has_more) throw new ApiError("Please contact support to review this billing account.", 409);
      // Unpaid/paused/incomplete subscriptions must be resolved, not duplicated.
      if (subscriptions.data.some(sub => !["canceled", "incomplete_expired"].includes(sub.status))) {
        return (await stripe.billingPortal.sessions.create({ customer,
          return_url: "https://www.getrestok.com/dashboard" })).url;
      }
      const previous = subscriptions.data[0];
      const price = previous?.items.data[0]?.price;
      if (!previous || previous.items.data.length !== 1 || !price?.active || !price.recurring) {
        throw new ApiError("Please contact support to select a replacement plan for this workspace.", 409);
      }
      const sessions = await stripe.checkout.sessions.list({ customer, limit: 100 });
      const last = sessions.data.find(session => session.metadata?.restok_recovery_org === orgId);
      if (last?.status === "open" && last.url) return last.url;
      const session = await stripe.checkout.sessions.create({
        mode: "subscription", customer,
        line_items: [{ price: price.id, quantity: previous.items.data[0].quantity ?? 1 }],
        metadata: { restok_recovery_org: orgId },
        subscription_data: { metadata: { restok_recovery_org: orgId, restok_plan: String(org.plan || "basic"), restok_price: price.id } },
        success_url: "https://www.getrestok.com/dashboard?billing=restored",
        cancel_url: "https://www.getrestok.com/dashboard",
      }, { idempotencyKey: `restok-recovery:${orgId}:${previous.id}:${last?.id || "initial"}` });
      if (!session.url) throw new Error("Checkout URL missing");
      return session.url;
    });
    return Response.json({ url });
  } catch (error) { return apiError(error); }
}
