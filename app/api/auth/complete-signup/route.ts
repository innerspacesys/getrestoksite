import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/auth/server";

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
  if (!data.uid || !data.expiresAt || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Invalid token or password must contain at least 8 characters" }, { status: 400 });
  }
  if (data.expiresAt.toDate() < new Date()) {
    return NextResponse.json({ error: "Token expired" }, { status: 400 });
  }

  // Set the account password in Supabase Auth.
  await adminAuth.updateUser(data.uid, { password });

  // Cleanup token
  await tokenRef.delete();

  return NextResponse.json({ success: true });
}
