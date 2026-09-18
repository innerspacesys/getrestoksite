import { NextResponse } from "next/server";
import { adminAuth, adminDb as db } from "@/lib/auth/server";

export async function POST(req: Request) {
  try {
    const { token, uid, disabled } = await req.json();

    // Verify caller
    const authUser = await adminAuth.verifyIdToken(token);
    const callerDoc = await db.collection("users").doc(authUser.uid).get();

    if (!callerDoc.exists || callerDoc.data()?.internalAdmin !== true) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Mark database
    await db.collection("users").doc(uid).update({
      disabled: disabled === true,
    });

    // Disable / Enable Supabase Auth
    await adminAuth.updateUser(uid, {
      disabled: disabled === true,
    });

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    console.log(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
