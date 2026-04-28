import { NextResponse } from "next/server";
import { Resend } from "resend";

type ContactPayload = {
  topic?: string;
  name?: string;
  email?: string;
  business?: string;
  message?: string;
};

export async function POST(req: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Email is not configured" },
        { status: 500 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const data = (await req.json()) as ContactPayload;

    await resend.emails.send({
      from: "Restok Contact <support@getrestok.com>",
      to: "support@getrestok.com",
      subject: `Contact: ${data.topic}`,
      text: `
Name: ${data.name}
Email: ${data.email}
Business: ${data.business || "N/A"}

Message:
${data.message}
      `,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: true }, { status: 500 });
  }
}
