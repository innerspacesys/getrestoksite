import { NextResponse } from "next/server";
import { getRequestIp, verifyTurnstileToken } from "@/lib/turnstile";

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { error: "Missing captcha token" },
        { status: 400 }
      );
    }

    const result = await verifyTurnstileToken(token, getRequestIp(req));

    if (!result.success) {
      return NextResponse.json(
        { error: "Captcha verification failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Turnstile verify error:", err);
    return NextResponse.json(
      { error: "Unable to verify captcha" },
      { status: 500 }
    );
  }
}
