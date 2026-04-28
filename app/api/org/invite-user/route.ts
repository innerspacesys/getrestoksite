import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import crypto from "crypto";
import { Resend } from "resend";

// PLANS — matches UI
const PLAN_LIMITS: Record<string, number | "infinite"> = {
  basic: 1,
  pro: 5,
  premium: "infinite",
  enterprise: "infinite",
};

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(req: Request) {
  try {
    // ---------------------------
    // AUTH
    // ---------------------------
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const requesterUid = decoded.uid;

    const { email, orgId } = await req.json();

    if (!email || !orgId) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }

    // ---------------------------
    // LOAD REQUESTER
    // ---------------------------
    const requesterSnap = await adminDb.doc(`users/${requesterUid}`).get();
    if (!requesterSnap.exists) {
      return NextResponse.json(
        { error: "Requester not found" },
        { status: 403 }
      );
    }

    const requester = requesterSnap.data()!;

    if (requester.orgId !== orgId) {
      return NextResponse.json(
        { error: "You do not belong to this organization" },
        { status: 403 }
      );
    }

    if (requester.role !== "owner" && requester.role !== "admin") {
      return NextResponse.json(
        { error: "Only owners and admins can invite users" },
        { status: 403 }
      );
    }

    // ---------------------------
    // CHECK PLAN LIMIT
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
    // CHECK IF USER ALREADY EXISTS
    // ---------------------------
    const existing = await adminAuth
      .getUserByEmail(email)
      .catch(() => null);

    if (existing) {
      return NextResponse.json(
        { error: "User already exists. Add existing users coming soon." },
        { status: 400 }
      );
    }

    // ---------------------------
    // CREATE AUTH ACCOUNT (NO PASSWORD)
    // ---------------------------
    const userRecord = await adminAuth.createUser({
      email,
      disabled: false,
    });

    // ---------------------------
    // CREATE USER PROFILE
    // ---------------------------
    await adminDb.doc(`users/${userRecord.uid}`).set({
      email,
      orgId,
      role: "member",
      createdAt: Timestamp.now(),
    });

    // ---------------------------
    // CREATE PASSWORD TOKEN
    // ---------------------------
    const tokenValue = crypto.randomBytes(32).toString("hex");

    await adminDb
      .collection("passwordSetupTokens")
      .doc(tokenValue)
      .set({
        uid: userRecord.uid,
        email,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(
          new Date(Date.now() + 1000 * 60 * 60 * 24)
        ),
      });

    const setupUrl = `https://getrestok.com/set-password?token=${tokenValue}`;

    // ---------------------------
    // SEND EMAIL
    // ---------------------------
    await getResend().emails.send({
      from: "Restok <accounts@getrestok.com>",
      to: email,
      subject: `You've been invited to join ${org.name} on Restok`,
      html: buildInviteEmail(org.name || "an organization", setupUrl),
    });

    // ---------------------------
    // AUDIT LOG
    // ---------------------------
    await adminDb.collection("auditLogs").add({
      type: "invite_sent",
      invited: email,
      orgId,
      by: requesterUid,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Invite user failed:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Something went wrong",
      },
      { status: 500 }
    );
  }
}

// ---------------------------
// EMAIL TEMPLATE
// ---------------------------
function buildInviteEmail(orgName: string, url: string) {
  return `
  <body style="background:#f1f5f9;padding:40px;font-family:Arial,sans-serif;">
  <table align="center" width="100%" style="max-width:520px;background:#fff;border-radius:14px;padding:32px;">
    <tr><td align="center">
      <img src="https://getrestok.com/logo.png" width="48" />
      <h1>You're invited to Restok</h1>
      <p>${orgName} has added you to their Restok account.</p>

      <a href="${url}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:14px 22px;border-radius:10px;text-decoration:none;">
        Set your password
      </a>

      <p style="font-size:12px;color:#64748b;margin-top:24px;">
        This link expires in 24 hours.
      </p>
    </td></tr>
  </table>
</body>`;
}
