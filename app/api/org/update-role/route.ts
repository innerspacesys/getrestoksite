import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

const ALLOWED_ROLES = ["admin", "member"] as const;
type AssignableRole = (typeof ALLOWED_ROLES)[number];

export async function POST(req: Request) {
  try {
    // ---------------------------
    // AUTH
    // ---------------------------
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const decoded = await adminAuth.verifyIdToken(token);
    const callerUid = decoded.uid;

    // ---------------------------
    // PARSE BODY
    // ---------------------------
    const { uid, role: newRole } = await req.json();

    if (!uid)
      return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    if (!ALLOWED_ROLES.includes(newRole as AssignableRole))
      return NextResponse.json(
        { error: "Invalid role. Must be 'admin' or 'member'. Use transfer-ownership to assign owner." },
        { status: 400 }
      );

    if (uid === callerUid)
      return NextResponse.json(
        { error: "You cannot change your own role" },
        { status: 400 }
      );

    // ---------------------------
    // LOAD CALLER
    // ---------------------------
    const callerSnap = await adminDb.collection("users").doc(callerUid).get();
    if (!callerSnap.exists)
      return NextResponse.json({ error: "Caller not found" }, { status: 404 });

    const caller = callerSnap.data()!;
    const orgId = caller.orgId;

    if (!orgId)
      return NextResponse.json({ error: "No organization" }, { status: 400 });

    if (caller.role !== "owner" && caller.role !== "admin")
      return NextResponse.json(
        { error: "Only owners and admins can change roles" },
        { status: 403 }
      );

    // ---------------------------
    // LOAD TARGET
    // ---------------------------
    const targetRef = adminDb.collection("users").doc(uid);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const target = targetSnap.data()!;

    if (target.orgId !== orgId)
      return NextResponse.json(
        { error: "User is not in your organization" },
        { status: 403 }
      );

    // Owners can only be reassigned via transfer-ownership
    if (target.role === "owner")
      return NextResponse.json(
        { error: "Cannot change the owner's role. Use transfer-ownership instead." },
        { status: 403 }
      );

    // No-op guard
    if (target.role === newRole)
      return NextResponse.json({ success: true });

    // ---------------------------
    // LAST ADMIN PROTECTION
    // Prevent demoting the last admin/owner
    // ---------------------------
    if (target.role === "admin" && newRole === "member") {
      const adminsSnap = await adminDb
        .collection("users")
        .where("orgId", "==", orgId)
        .where("role", "in", ["admin", "owner"])
        .get();

      if (adminsSnap.size <= 1)
        return NextResponse.json(
          { error: "Organization must have at least one admin" },
          { status: 400 }
        );
    }

    // ---------------------------
    // UPDATE ROLE
    // ---------------------------
    await targetRef.update({ role: newRole });

    // Audit log
    await adminDb.collection("auditLogs").add({
      type: "role_change",
      targetUid: uid,
      from: target.role,
      to: newRole,
      orgId,
      by: callerUid,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("update-role error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}