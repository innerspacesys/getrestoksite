import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

/**
 * INTERNAL: Delete user (and org if owner)
 * Requires Firebase custom claim: internalAdmin === true
 */
export async function POST(req: Request) {
  try {
    const { token, uid } = await req.json();

    if (!token || !uid) {
      return NextResponse.json(
        { error: "Missing token or uid" },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // VERIFY INTERNAL ADMIN (CUSTOM CLAIM)
    // --------------------------------------------------
    const decoded = await adminAuth.verifyIdToken(token);

    if (!decoded.internalAdmin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // LOAD USER DOC (FOR ORG CLEANUP)
    // --------------------------------------------------
    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();

    const orgId = userSnap.exists ? userSnap.data()?.orgId : null;

    // --------------------------------------------------
    // DELETE USER FIRESTORE DOC
    // --------------------------------------------------
    await userRef.delete().catch(() => null);

    // --------------------------------------------------
    // DELETE ORG IF USER IS OWNER
    // --------------------------------------------------
    if (orgId) {
      const orgRef = adminDb.collection("organizations").doc(orgId);
      const orgSnap = await orgRef.get();

      if (orgSnap.exists && orgSnap.data()?.ownerId === uid) {
        await orgRef.delete();
      }
    }

    // --------------------------------------------------
    // DELETE FIREBASE AUTH USER
    // --------------------------------------------------
    await adminAuth.deleteUser(uid);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("❌ Internal delete-user error:", err);

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to delete user",
      },
      { status: 500 }
    );
  }
}
