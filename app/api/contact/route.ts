import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import {
  buildContactConfirmationEmail,
  buildContactNotificationEmail,
} from "@/lib/emailTemplates";

type ContactPayload = {
  topic?: string;
  name?: string;
  email?: string;
  business?: string;
  message?: string;
};

export async function POST(req: Request) {
  try {
    const data = (await req.json()) as ContactPayload;

    const internalMessage = buildContactNotificationEmail(data);
    await sendEmail({
      from: "Restok Contact <support@getrestok.com>",
      to: "support@getrestok.com",
      subject: internalMessage.subject,
      html: internalMessage.html,
      text: internalMessage.text,
    });

    if (data.email) {
      const confirmation = buildContactConfirmationEmail(data);
      await sendEmail({
        from: "Restok <support@getrestok.com>",
        to: data.email,
        subject: confirmation.subject,
        html: confirmation.html,
        text: confirmation.text,
        replyTo: "support@getrestok.com",
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: true }, { status: 500 });
  }
}
