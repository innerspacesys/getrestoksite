import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    // ---------------------------
    // AUTH — verify caller
    // ---------------------------
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = await adminAuth.verifyIdToken(token);
    const callerUid = decoded.uid;

    // ---------------------------
    // PARSE BODY
    // ---------------------------
    const { uid } = await req.json();
    if (!uid)
      return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    if (uid === callerUid)
      return NextResponse.json(
        { error: "You are already the owner" },
        { status: 400 }
      );

    // ---------------------------
    // LOAD CALLER
    // ---------------------------
    const callerSnap = await adminDb.doc(`users/${callerUid}`).get();
    if (!callerSnap.exists)
      return NextResponse.json({ error: "Caller not found" }, { status: 404 });

    const caller = callerSnap.data()!;

    if (caller.role !== "owner")
      return NextResponse.json(
        { error: "Only the organization owner can transfer ownership" },
        { status: 403 }
      );

    const orgId = caller.orgId;
    if (!orgId)
      return NextResponse.json(
        { error: "Caller has no organization" },
        { status: 400 }
      );

    // ---------------------------
    // LOAD TARGET USER
    // ---------------------------
    const targetSnap = await adminDb.doc(`users/${uid}`).get();
    if (!targetSnap.exists)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const target = targetSnap.data()!;

    if (target.orgId !== orgId)
      return NextResponse.json(
        { error: "User is not in your organization" },
        { status: 403 }
      );

    // ---------------------------
    // LOAD ORG — confirm ownerId matches caller
    // ---------------------------
    const orgRef = adminDb.doc(`organizations/${orgId}`);
    const orgSnap = await orgRef.get();

    if (!orgSnap.exists)
      return NextResponse.json({ error: "Org not found" }, { status: 404 });

    const org = orgSnap.data()!;

    if (org.ownerId !== callerUid)
      return NextResponse.json(
        { error: "Org ownership record does not match your account" },
        { status: 403 }
      );

    // Redundant safety check — target shouldn't already be owner
    if (org.ownerId === uid)
      return NextResponse.json(
        { error: "User is already the owner" },
        { status: 400 }
      );

    // ---------------------------
    // TRANSFER
    // ---------------------------

    // Demote current owner → admin
    await adminDb.doc(`users/${callerUid}`).update({ role: "admin" });

    // Promote new owner
    await targetSnap.ref.update({ role: "owner" });

    // Update org record
    await orgRef.update({ ownerId: uid });

    // ---------------------------
    // AUDIT LOG
    // ---------------------------
    await adminDb.collection("auditLogs").add({
      type: "ownership_transfer",
      from: callerUid,
      to: uid,
      orgId,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("transfer-ownership error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}