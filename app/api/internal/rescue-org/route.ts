import { adminDb } from "@/lib/auth/server";
import { assertInternal, internalError, logInternalAction, InternalError } from "@/lib/internalApi";

// Reactivate a canceled/paused workspace and cancel any scheduled deletion —
// e.g. to rescue an accidental cancellation before the purge job runs.
export async function POST(req: Request) {
  try {
    const { token, orgId } = await req.json();
    const { uid } = await assertInternal(token);
    if (typeof orgId !== "string" || !orgId) throw new InternalError("Missing orgId");

    await adminDb.collection("organizations").doc(orgId).update({
      active: true,
      status: "active",
      canceledAt: null,
      scheduledDeletionAt: null,
      manualPlanOverride: true,
    });

    await logInternalAction(uid, orgId, "org_rescued", {});
    return Response.json({ success: true });
  } catch (error) {
    return internalError(error);
  }
}
