import { adminAuth, adminDb } from "@/lib/auth/server";
import { assertInternal, internalError, logInternalAction, InternalError } from "@/lib/internalApi";

/**
 * INTERNAL: Delete user (and org if owner). Requires internalAdmin.
 */
export async function POST(req: Request) {
  try {
    const { token, uid } = await req.json();
    const { uid: actorUid } = await assertInternal(token);
    if (typeof uid !== "string" || !uid) throw new InternalError("Missing uid");

    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const orgId = userSnap.exists ? (userSnap.data()?.orgId as string | undefined) : undefined;
    const email = userSnap.exists ? userSnap.data()?.email : null;

    await userRef.delete().catch(() => null);

    if (orgId) {
      const orgRef = adminDb.collection("organizations").doc(orgId);
      const orgSnap = await orgRef.get();
      if (orgSnap.exists && orgSnap.data()?.ownerId === uid) {
        await orgRef.delete();
      }
    }

    await adminAuth.deleteUser(uid);

    await logInternalAction(actorUid, orgId ?? null, "user_deleted", { uid, email });
    return Response.json({ success: true });
  } catch (error) {
    return internalError(error);
  }
}
