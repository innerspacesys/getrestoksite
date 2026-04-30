import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

type AccountStatusBody = {
  email?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AccountStatusBody;
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "Missing email" },
        { status: 400 }
      );
    }

    const exactMatch = await adminDb
      .collection("users")
      .where("email", "==", body.email?.trim())
      .limit(1)
      .get();

    const normalizedMatch =
      exactMatch.empty
        ? await adminDb
            .collection("users")
            .where("email", "==", email)
            .limit(1)
            .get()
        : exactMatch;

    if (normalizedMatch.empty) {
      return NextResponse.json({
        exists: false,
        hasWorkspace: false,
      });
    }

    const user = normalizedMatch.docs[0].data() as {
      orgId?: string | null;
      role?: string;
      disabled?: boolean;
      accountStatus?: string | null;
      scheduledDeletionAt?: { toDate?: () => Date } | null;
    };

    return NextResponse.json({
      exists: true,
      hasWorkspace: Boolean(user.orgId),
      orgId: user.orgId || null,
      role: user.role || null,
      disabled: Boolean(user.disabled),
      accountStatus: user.accountStatus || "active",
      scheduledDeletionAt:
        user.scheduledDeletionAt?.toDate?.().toISOString?.() || null,
    });
  } catch (err) {
    console.error("Account status error:", err);
    return NextResponse.json(
      { error: "Failed to check account status" },
      { status: 500 }
    );
  }
}
