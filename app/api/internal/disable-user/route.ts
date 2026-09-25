import { adminAuth, adminDb } from "@/lib/auth/server";
import { assertInternal, internalError, logInternalAction, InternalError } from "@/lib/internalApi";

export async function POST(req: Request) {
  try {
    const { token, uid, disabled } = await req.json();
    const { uid: actorUid } = await assertInternal(token);
    if (typeof uid !== "string" || !uid) throw new InternalError("Missing uid");

    const disable = disabled === true;
    await adminDb.collection("users").doc(uid).update({ disabled: disable });
    await adminAuth.updateUser(uid, { disabled: disable });

    await logInternalAction(actorUid, null, disable ? "user_disabled" : "user_enabled", { uid });
    return Response.json({ success: true });
  } catch (error) {
    return internalError(error);
  }
}
