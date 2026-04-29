import { NextResponse } from "next/server";
import crypto from "crypto";
import { sendEmail } from "@/lib/email";
import { buildInboundForwardEmail } from "@/lib/emailTemplates";

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

    const message = buildInboundForwardEmail({
      from: email.from,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    await sendEmail({
      from: "Restok Support <support@getrestok.com>",
      to: "braden@issioffice.com",
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: email.from,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("resend inbound error", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
