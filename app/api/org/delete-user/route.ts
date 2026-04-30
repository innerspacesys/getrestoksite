import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

const ACCOUNT_RETENTION_DAYS = 30;

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing auth token" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = await adminAuth.verifyIdToken(token);
    const callerUid = decoded.uid;

    const { uid } = (await req.json()) as { uid?: string };
    if (!uid) {
      return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    }

    if (uid === callerUid) {
      return NextResponse.json(
        { error: "You cannot remove yourself." },
        { status: 400 }
      );
    }

    const callerSnap = await adminDb.collection("users").doc(callerUid).get();
    if (!callerSnap.exists) {
      return NextResponse.json({ error: "Caller not found" }, { status: 404 });
    }

    const caller = callerSnap.data()!;
    const orgId = caller.orgId;

    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    if (caller.role !== "owner" && caller.role !== "admin") {
      return NextResponse.json(
        { error: "Only owners and admins can remove users" },
        { status: 403 }
      );
    }

    const targetRef = adminDb.collection("users").doc(uid);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const target = targetSnap.data()!;

    if (target.orgId !== orgId) {
      return NextResponse.json(
        { error: "User is not in your organization" },
        { status: 403 }
      );
    }

    if (target.role === "owner") {
      return NextResponse.json(
        { error: "You cannot remove the organization owner" },
        { status: 403 }
      );
    }

    if (target.role === "admin") {
      const adminsSnap = await adminDb
        .collection("users")
        .where("orgId", "==", orgId)
        .where("role", "in", ["admin", "owner"])
        .get();

      if (adminsSnap.size <= 1) {
        return NextResponse.json(
          { error: "Organization must have at least one admin" },
          { status: 400 }
        );
      }
    }

    const removedAt = Timestamp.now();
    const scheduledDeletionAt = Timestamp.fromDate(
      new Date(Date.now() + ACCOUNT_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    );

    await targetRef.update({
      orgId: null,
      role: "member",
      disabled: true,
      accountStatus: "deactivated",
      removedAt,
      deactivatedAt: removedAt,
      scheduledDeletionAt,
    });

    await adminAuth.updateUser(uid, {
      disabled: true,
    });

    await adminAuth.revokeRefreshTokens(uid);

    await adminDb.collection("auditLogs").add({
      type: "user_removed",
      targetUid: uid,
      orgId,
      by: callerUid,
      createdAt: new Date(),
      scheduledDeletionAt: scheduledDeletionAt.toDate(),
    });

    return NextResponse.json({
      success: true,
      scheduledDeletionDays: ACCOUNT_RETENTION_DAYS,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("delete-user error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
