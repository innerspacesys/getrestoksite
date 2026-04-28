import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = getFirestore();

export async function POST(req: Request) {
  try {
    const { token, uid, disabled } = await req.json();

    // Verify caller
    const authUser = await admin.auth().verifyIdToken(token);
    const callerDoc = await db.collection("users").doc(authUser.uid).get();

    if (!callerDoc.exists || callerDoc.data()?.internalAdmin !== true) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Mark Firestore
    await db.collection("users").doc(uid).update({
      disabled: disabled === true,
    });

    // Disable / Enable Firebase Auth
    await admin.auth().updateUser(uid, {
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
