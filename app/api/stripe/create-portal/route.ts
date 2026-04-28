import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe not configured");
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

export async function POST(req: Request) {
  try {
    // ---------------------------
    // AUTH
    // ---------------------------
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const decoded = await adminAuth.verifyIdToken(token);
    const callerUid = decoded.uid;

    // ---------------------------
    // PARSE BODY
    // ---------------------------
    const { orgId } = await req.json();
    if (!orgId)
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

    // ---------------------------
    // CONFIRM CALLER BELONGS TO THIS ORG
    // ---------------------------
    const callerSnap = await adminDb.collection("users").doc(callerUid).get();
    if (!callerSnap.exists)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const caller = callerSnap.data()!;

    if (caller.orgId !== orgId)
      return NextResponse.json(
        { error: "You do not belong to this organization" },
        { status: 403 }
      );

    if (caller.role !== "owner" && caller.role !== "admin")
      return NextResponse.json(
        { error: "Only owners and admins can manage billing" },
        { status: 403 }
      );

    // ---------------------------
    // LOAD ORG + CREATE PORTAL SESSION
    // ---------------------------
    const orgSnap = await adminDb.collection("organizations").doc(orgId).get();
    const org = orgSnap.data();

    if (!org?.stripeCustomerId)
      return NextResponse.json(
        { error: "No Stripe customer found" },
        { status: 400 }
      );

    const session = await getStripe().billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: "https://getrestok.com/dashboard/settings",
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("create-portal error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
