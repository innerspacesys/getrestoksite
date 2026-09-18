import { adminAuth, adminDb } from "@/lib/auth/server";
export async function POST(req: Request) {
  try {
    const { token, uid } = await req.json();
    const caller = await adminAuth.verifyIdToken(token);
    if (!caller.internalAdmin) return Response.json({ error: "Unauthorized" }, { status: 403 });
    if (typeof uid !== "string" || !uid) return Response.json({ error: "Missing user" }, { status: 400 });
    await adminDb.collection("users").doc(uid).update({ orgId: null, role: "member" });
    return Response.json({ success: true });
  } catch { return Response.json({ error: "Unable to remove membership" }, { status: 400 }); }
}
