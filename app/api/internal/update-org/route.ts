import { adminDb } from "@/lib/auth/server";
import { assertInternal, internalError, logInternalAction, InternalError } from "@/lib/internalApi";

const PLANS = ["basic", "pro", "premium", "enterprise"];
const STATUSES = ["active", "paused", "canceled"];

export async function POST(req: Request) {
  try {
    const { token, orgId, changes } = await req.json();
    const { uid } = await assertInternal(token);
    if (typeof orgId !== "string" || !orgId) throw new InternalError("Missing orgId");

    const update: Record<string, unknown> = {};
    if (typeof changes?.plan === "string" && PLANS.includes(changes.plan)) {
      update.plan = changes.plan;
      update.manualPlanOverride = true; // Manual plan change pins it against Stripe.
    }
    if (typeof changes?.status === "string" && STATUSES.includes(changes.status)) {
      update.status = changes.status;
    }
    if (typeof changes?.manualPlanOverride === "boolean") {
      update.manualPlanOverride = changes.manualPlanOverride;
    }
    if (typeof changes?.internalNotes === "string") {
      update.internalNotes = changes.internalNotes.slice(0, 5000);
    }

    if (!Object.keys(update).length) throw new InternalError("No valid changes");

    await adminDb.collection("organizations").doc(orgId).update(update);
    await logInternalAction(uid, orgId, "org_updated", { changes: update });
    return Response.json({ success: true });
  } catch (error) {
    return internalError(error);
  }
}
