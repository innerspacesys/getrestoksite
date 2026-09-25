import { randomBytes } from "node:crypto";
import { adminDb } from "@/lib/auth/server";
import { Timestamp } from "@/lib/data/server";
import { getPool } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { buildPasswordSetupEmail } from "@/lib/emailTemplates";
import { assertInternal, internalError, logInternalAction, InternalError } from "@/lib/internalApi";

// Re-send a password-setup link to a user (e.g. one who never finished signup).
export async function POST(req: Request) {
  try {
    const { token, uid } = await req.json();
    const { uid: actorUid } = await assertInternal(token);
    if (typeof uid !== "string" || !uid) throw new InternalError("Missing uid");

    const { rows } = await getPool().query(
      `select p.email, p.name, p.org_id, o.name as org_name
       from public.profiles p
       left join public.organizations o on o.id = p.org_id
       where p.id = $1`,
      [uid]
    );
    const user = rows[0];
    if (!user?.email) throw new InternalError("User has no email on file", 404);

    const setupToken = randomBytes(32).toString("hex");
    await adminDb.collection("passwordSetupTokens").doc(setupToken).set({
      uid,
      email: user.email,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    });

    const message = buildPasswordSetupEmail({
      recipientName: user.name || "there",
      setupUrl: `https://www.getrestok.com/set-password?token=${setupToken}`,
      orgName: user.org_name || "your workspace",
    });

    await sendEmail({
      from: "Restok <accounts@getrestok.com>",
      to: user.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    await logInternalAction(actorUid, user.org_id ?? null, "resend_password_setup", {
      uid,
      email: user.email,
    });
    return Response.json({ success: true, to: user.email });
  } catch (error) {
    return internalError(error);
  }
}
