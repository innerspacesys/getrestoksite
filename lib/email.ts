import { Resend } from "resend";

type SendEmailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string;
  }>;
};

export function resolveNotificationEmail(user: {
  email?: string;
  notificationEmail?: string;
}): string | null {
  return user.notificationEmail || user.email || null;
}

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  from = "Restok <no-reply@getrestok.com>",
  bcc,
  replyTo,
  attachments,
}: SendEmailOptions) {
  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from,
      to,
      bcc,
      replyTo,
      subject,
      html,
      text,
      attachments,
    });

    if (error) {
      console.error("❌ Resend error:", error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error("❌ Email send failed:", err);
    throw err;
  }
}
