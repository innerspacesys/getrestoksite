import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
      );
    }

    const tokenRef = adminDb.collection("passwordSetupTokens").doc(token);
    const tokenSnap = await tokenRef.get();

    if (!tokenSnap.exists) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 400 }
      );
    }

    const data = tokenSnap.data();

    if (!data?.uid || !data?.expiresAt) {
      return NextResponse.json(
        { error: "Invalid token data" },
        { status: 400 }
      );
    }

    // Check expiration
    const now = Timestamp.now();
    if (now.toMillis() > data.expiresAt.toMillis()) {
      return NextResponse.json(
        { error: "Token expired" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      email: data.email || null,
      uid: data.uid,
    });
  } catch (err: unknown) {
    console.error("validate-password-token failed:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
