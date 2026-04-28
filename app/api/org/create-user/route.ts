import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";

// Seat limits (same logic as UI)
const PLAN_LIMITS: Record<string, number | "infinite"> = {
  basic: 1,
  pro: 5,
  premium: "infinite",
  enterprise: "infinite",
};

export async function POST(req: Request) {
  try {
    // ---------------------------
    //  AUTH CHECK
    // ---------------------------
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const requesterUid = decoded.uid;

    const { email, password, orgId } = await req.json();

    if (!email || !password || !orgId) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }

    // ---------------------------
    //  LOAD REQUESTER
    // ---------------------------
    const requesterSnap = await adminDb.doc(`users/${requesterUid}`).get();

    if (!requesterSnap.exists) {
      return NextResponse.json(
        { error: "Requester not found" },
        { status: 403 }
      );
    }

    const requester = requesterSnap.data()!;

    // Must belong to same org
    if (requester.orgId !== orgId) {
      return NextResponse.json(
        { error: "You do not belong to this organization" },
        { status: 403 }
      );
    }

    // Must be owner or admin
    if (requester.role !== "owner" && requester.role !== "admin") {
      return NextResponse.json(
        { error: "Only owners and admins can create users" },
        { status: 403 }
      );
    }

    // ---------------------------
    //  CHECK PLAN LIMIT
    // ---------------------------
    const orgRef = adminDb.doc(`organizations/${orgId}`);
    const orgSnap = await orgRef.get();

    if (!orgSnap.exists) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const org = orgSnap.data()!;
    const plan: string = org.plan || "basic";

    const limit = PLAN_LIMITS[plan] ?? 1;

    if (limit !== "infinite") {
      const membersSnap = await adminDb
        .collection("users")
        .where("orgId", "==", orgId)
        .get();

      if (membersSnap.size >= limit) {
        return NextResponse.json(
          { error: "Seat limit reached for your plan" },
          { status: 403 }
        );
      }
    }

    // ---------------------------
    //  CREATE FIREBASE AUTH USER
    // ---------------------------
    const userRecord = await getAuth().createUser({
      email,
      password,
    });

    // ---------------------------
    //  CREATE FIRESTORE PROFILE
    // ---------------------------
    await adminDb.doc(`users/${userRecord.uid}`).set({
      email,
      orgId,
      role: "member",
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Create user failed:", err);

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Something went wrong",
      },
      { status: 500 }
    );
  }
}
