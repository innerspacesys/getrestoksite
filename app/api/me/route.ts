import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // Verify Firebase ID Token
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Load user from Firestore
    const userSnap = await adminDb.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const user = userSnap.data();
    if (user?.disabled || user?.accountStatus === "deactivated") {
      return NextResponse.json(
        { error: "Account deactivated" },
        { status: 403 }
      );
    }

    let orgData = null;

    if (user?.orgId) {
      const orgSnap = await adminDb
        .collection("organizations")
        .doc(user.orgId)
        .get();

      if (orgSnap.exists) orgData = orgSnap.data();
    }

    return NextResponse.json({
      uid,
      email: decoded.email,
      name: user?.name || decoded.name || "User",
      orgId: user?.orgId || null,
      orgName: orgData?.name || "No Organization",
      plan: orgData?.plan || "basic",
    });
  } catch (err) {
    console.error("ME API ERROR", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
