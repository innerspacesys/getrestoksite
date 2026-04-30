import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getRequestIp, verifyTurnstileToken } from "@/lib/turnstile";

export async function POST(req: Request) {
  try {
    const { token, turnstileToken } = await req.json();

    if (!token)
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
      );

    if (process.env.TURNSTILE_SECRET_KEY) {
      if (!turnstileToken) {
        return NextResponse.json(
          { error: "Please complete the security check." },
          { status: 400 }
        );
      }

      const captcha = await verifyTurnstileToken(
        turnstileToken,
        getRequestIp(req)
      );

      if (!captcha.success) {
        return NextResponse.json(
          { error: "Captcha verification failed." },
          { status: 400 }
        );
      }
    }

    // Verify Firebase token
    const decoded = await getAuth().verifyIdToken(token);

    // Cookie expires when Firebase session expires
    const expires = new Date(decoded.exp! * 1000);

    const res = NextResponse.json({ ok: true });

    res.cookies.set("__session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires,
    });

    return res;
  } catch (err) {
    console.error("SET SESSION ERROR", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
