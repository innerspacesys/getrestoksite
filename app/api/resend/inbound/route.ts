import { NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  return new Resend(process.env.RESEND_API_KEY);
}

function verifySignature(rawBody: string, signature: string) {
  const signingSecret = process.env.RESEND_EMAIL_FORWARD_WEBHOOK_SECRET;
  if (!signingSecret) {
    throw new Error("Missing RESEND_EMAIL_FORWARD_WEBHOOK_SECRET");
  }

  const digest = crypto
    .createHmac("sha256", signingSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(digest),
    Buffer.from(signature)
  );
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    const signature = req.headers.get("resend-signature");
    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const event = JSON.parse(rawBody);

    if (event.type !== "email.received") {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const email = event.data;

    await getResend().emails.send({
      from: "Restok Support <support@getrestok.com>",
      to: "braden@issioffice.com",
      subject: `FWD: ${email.subject || "No subject"}`,
      html: email.html || `<pre>${email.text || ""}</pre>`,
      replyTo: email.from,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("resend inbound error", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
