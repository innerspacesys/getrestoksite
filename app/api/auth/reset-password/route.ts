import { NextResponse } from "next/server";
import { getPool, getSupabaseAdmin } from "@/lib/supabase/admin";
import { getRequestIp, verifyTurnstileToken } from "@/lib/turnstile";
import { sendEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const { email, turnstileToken } = await req.json();
    if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    const captcha = await verifyTurnstileToken(typeof turnstileToken === "string" ? turnstileToken : "", getRequestIp(req));
    if (!captcha.success) return NextResponse.json({ error: "Please complete the security check." }, { status: 400 });
    // Atomic cooldown across server instances; responses do not reveal account existence.
    const { rows } = await getPool().query(`update public.profiles set metadata = metadata || jsonb_build_object('lastPasswordResetAt',now())
      where lower(email)=lower($1) and auth_user_id is not null and not disabled
      and (metadata->>'lastPasswordResetAt' is null or (metadata->>'lastPasswordResetAt')::timestamptz < now()-interval '5 minutes')
      returning email`, [email.trim()]);
    if (rows.length) {
      const { data, error } = await getSupabaseAdmin().auth.admin.generateLink({ type: "recovery", email: rows[0].email });
      if (error) throw error;
      const url = `https://getrestok.com/reset-password#token=${encodeURIComponent(data.properties.hashed_token)}`;
      await sendEmail({ to: rows[0].email, subject: "Reset your Restok password", html: `<p>A password reset was requested for your Restok account.</p><p><a href="${url}">Choose a new password</a></p><p>If you didn't request this, you can ignore this email.</p>`, text: `Choose a new Restok password: ${url}\nIf you didn't request this, ignore this email.` });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unable to send a reset link. Please try again shortly." }, { status: 503 });
  }
}
