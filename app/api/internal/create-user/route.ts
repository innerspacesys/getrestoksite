import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

/**
 * INTERNAL: Create test user
 * Requires Firebase custom claim: internalAdmin === true
 */
export async function POST(req: Request) {
  try {
    const { token, email, password, name } = await req.json();

    if (!token || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
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
    // CREATE AUTH USER
    // --------------------------------------------------
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name || "Tester",
    });

    const uid = userRecord.uid;

    // --------------------------------------------------
    // CREATE ORGANIZATION (TEST / BETA)
    // --------------------------------------------------
    const orgRef = adminDb.collection("organizations").doc(uid);

    await orgRef.set({
      name: `${name || "Tester"}'s Organization`,
      ownerId: uid,
      plan: "basic",            // ⚠️ paid plan, not free
      beta: true,
      createdAt: new Date(),
    });

    // --------------------------------------------------
    // CREATE USER PROFILE
    // --------------------------------------------------
    await adminDb.collection("users").doc(uid).set({
      email,
      name: name || "",
      orgId: uid,
      role: "owner",
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      uid,
      orgId: uid,
    });
  } catch (err: unknown) {
    console.error("❌ Internal create-user error:", err);

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to create user",
      },
      { status: 500 }
    );
  }
}
