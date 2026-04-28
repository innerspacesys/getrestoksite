import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  const { token, password } = await req.json();

  if (!token || !password) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  const tokenRef = adminDb.collection("passwordSetupTokens").doc(token);
  const snap = await tokenRef.get();

  if (!snap.exists) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const data = snap.data()!;
  if (data.expiresAt.toDate() < new Date()) {
    return NextResponse.json({ error: "Token expired" }, { status: 400 });
  }

  // Set Firebase password
  await adminAuth.updateUser(data.uid, { password });

  // Cleanup token
  await tokenRef.delete();

  return NextResponse.json({ success: true });
}
