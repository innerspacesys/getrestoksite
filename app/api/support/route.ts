import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import {
  buildSupportConfirmationEmail,
  buildSupportNotificationEmail,
} from "@/lib/emailTemplates";

// CHANGE THESE
const SUPPORT_TO = "support@getrestok.com";
const BCC = [
  "cory@issioffice.com",
  "braden@issioffice.com",
  "issichatt@gmail.com",
];

type SupportMetadata = {
  name?: string;
  email?: string;
  orgName?: string;
  plan?: string;
  uid?: string;
};

type EmailAttachment = {
  filename: string;
  content: string;
};

export async function POST(request: Request) {
  try {
    const form = await request.formData();

    const metadata = JSON.parse(
      String(form.get("metadata") || "{}")
    ) as SupportMetadata;
    const subject = form.get("subject") as string;
    const message = form.get("message") as string;

    const file = form.get("file") as File | null;

    const attachments: EmailAttachment[] = [];

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      attachments.push({
        filename: file.name,
        content: buffer.toString("base64"),
      });
    }

    const internalMessage = buildSupportNotificationEmail({
      subject,
      message,
      metadata,
    });

    await sendEmail({
      from: "Restok Support <support@getrestok.com>",
      to: SUPPORT_TO,
      bcc: BCC,
      subject: internalMessage.subject,
      html: internalMessage.html,
      text: internalMessage.text,
      attachments,
    });

    if (metadata.email) {
      const confirmation = buildSupportConfirmationEmail({
        subject,
        metadata,
      });

      await sendEmail({
        from: "Restok <support@getrestok.com>",
        to: metadata.email,
        subject: confirmation.subject,
        html: confirmation.html,
        text: confirmation.text,
        replyTo: SUPPORT_TO,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("SUPPORT API ERROR", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
