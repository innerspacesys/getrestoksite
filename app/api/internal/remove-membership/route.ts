import { adminDb } from "@/lib/auth/server";
import { assertInternal, internalError, logInternalAction, InternalError } from "@/lib/internalApi";

export async function POST(req: Request) {
  try {
    const { token, uid } = await req.json();
    const { uid: actorUid } = await assertInternal(token);
    if (typeof uid !== "string" || !uid) throw new InternalError("Missing user");

    const before = (await adminDb.collection("users").doc(uid).get()).data();
    await adminDb.collection("users").doc(uid).update({ orgId: null, role: "member" });

    await logInternalAction(actorUid, before?.orgId ?? null, "membership_removed", { uid });
    return Response.json({ success: true });
  } catch (error) {
    return internalError(error);
  }
}
