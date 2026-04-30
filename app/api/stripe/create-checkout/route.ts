import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { getRequestIp, verifyTurnstileToken } from "@/lib/turnstile";

type Plan = "basic" | "pro" | "premium" ;
type Interval = "monthly" | "yearly";
type CheckoutBody = {
  email?: string;
  name?: string;
  orgName?: string;
  phone?: string;
  plan?: Plan;
  interval?: Interval;
  turnstileToken?: string;
  authToken?: string;
};

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 500 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const body = (await req.json()) as CheckoutBody;

    const email = body.email;
    const name = body.name;
    const orgName = body.orgName?.trim();
    const phone = body.phone;
    const plan = (body.plan ?? "") as Plan;
    const interval = (body.interval ?? "monthly") as Interval;
    const turnstileToken = body.turnstileToken;
    const authToken = body.authToken;

    if (!email || !plan) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (process.env.TURNSTILE_SECRET_KEY) {
      if (!turnstileToken) {
        return NextResponse.json(
          { error: "Missing captcha token" },
          { status: 400 }
        );
      }

      const captcha = await verifyTurnstileToken(
        turnstileToken,
        getRequestIp(req)
      );

      if (!captcha.success) {
        return NextResponse.json(
          { error: "Captcha verification failed" },
          { status: 400 }
        );
      }
    }

    let googleUid: string | null = null;
    let googleEmail: string | null = null;

    if (authToken) {
      const decoded = await adminAuth.verifyIdToken(authToken);
      googleUid = decoded.uid;
      googleEmail = decoded.email || null;

      if (googleEmail && googleEmail.toLowerCase() !== email.toLowerCase()) {
        return NextResponse.json(
          { error: "Google account email does not match signup email" },
          { status: 400 }
        );
      }

      const existingProfile = await adminDb
        .collection("users")
        .doc(decoded.uid)
        .get();

      if (existingProfile.exists && existingProfile.data()?.orgId) {
        return NextResponse.json(
          { error: "This Google account already belongs to a Restok workspace" },
          { status: 400 }
        );
      }
    }

    const existingEmailProfile = await adminDb
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!existingEmailProfile.empty && existingEmailProfile.docs[0].data()?.orgId) {
      return NextResponse.json(
        { error: "An account already exists for this email. Please log in instead." },
        { status: 409 }
      );
    }

    const priceMap: Record<Plan, Record<Interval, string | undefined>> = {
      basic: {
        monthly: process.env.STRIPE_MONTHLY_BASIC_PRICE_ID,
        yearly: process.env.STRIPE_YEARLY_BASIC_PRICE_ID,
      },
      pro: {
        monthly: process.env.STRIPE_MONTHLY_PRO_PRICE_ID,
        yearly: process.env.STRIPE_YEARLY_PRO_PRICE_ID,
      },
      premium: {
        monthly: process.env.STRIPE_MONTHLY_PREMIUM_PRICE_ID,
        yearly: process.env.STRIPE_YEARLY_PREMIUM_PRICE_ID,
      },
      //enterprise: {         ADD LATER 
      //  monthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
      //  yearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID,
    //  },
    };

    const price = priceMap[plan]?.[interval];

    if (!price) {
      return NextResponse.json(
        { error: "Invalid plan or billing interval" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,

      metadata: {
        plan,
        interval,
        email,
        name: name || "",
        orgName: orgName || "",
        phone: phone || "",
        googleUid: googleUid || "",
      },

      line_items: [
        {
          price,
          quantity: 1,
        },
      ],

      success_url: "https://getrestok.com/login?setup=1",
      cancel_url: "https://getrestok.com/signup",
    });

    await adminDb.collection("pendingSignups").doc(session.id).set({
      email,
      name: name || "",
      orgName: orgName || "",
      phone: phone || "",
      plan,
      interval,
      googleUid: googleUid || "",
      googleEmail: googleEmail || "",
      createdAt: new Date(),
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Create checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
