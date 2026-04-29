import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import crypto from "crypto";
import { sendEmail } from "@/lib/email";
import { buildPasswordSetupEmail } from "@/lib/emailTemplates";

// PLANS — matches UI
const PLAN_LIMITS: Record<string, number | "infinite"> = {
  basic: 1,
  pro: 5,
  premium: "infinite",
  enterprise: "infinite",
};

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
    const message = buildPasswordSetupEmail({
      setupUrl,
      orgName: org.name || "an organization",
      invited: true,
    });

    await sendEmail({
      from: "Restok <accounts@getrestok.com>",
      to: email,
      subject: message.subject,
      html: message.html,
      text: message.text,
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
