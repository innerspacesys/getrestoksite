import { NextResponse } from "next/server";
import { Resend } from "resend";

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
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Email is not configured" },
        { status: 500 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
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

    const html = `
      <h2>New Support Request</h2>

      <p><strong>Subject:</strong> ${subject}</p>
      <p>${message.replace(/\n/g, "<br>")}</p>

      <hr>

      <h3>User Info</h3>
      <p><strong>Name:</strong> ${metadata?.name}</p>
      <p><strong>Email:</strong> ${metadata?.email}</p>
      <p><strong>Org:</strong> ${metadata?.orgName}</p>
      <p><strong>Plan:</strong> ${metadata?.plan}</p>
      <p><strong>UID:</strong> ${metadata?.uid}</p>
    `;

    await resend.emails.send({
      from: "Restok Support <support@getrestok.com>",
      to: SUPPORT_TO,
      bcc: BCC,
      subject: `Support — ${subject}`,
      html,
      attachments,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("SUPPORT API ERROR", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
