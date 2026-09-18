import { Timestamp } from "@/lib/data/server";
import { adminDb } from "@/lib/auth/server";
import { apiError, ApiError, requireMember } from "@/lib/apiAuth";
import { resolveNotificationEmail, sendEmail } from "@/lib/email";
import { buildTestNotificationEmail } from "@/lib/emailTemplates";

export async function POST(req: Request) {
  try {
    const { uid, userRef } = await requireMember(req);
    const to = await adminDb.runTransaction(async tx => {
      const user = (await tx.get(userRef)).data()!;
      const recipient = resolveNotificationEmail(user);
      if (!recipient) throw new ApiError("Save a valid notification email first.");
      if (Date.now() - (user.lastNotificationTestAt?.toMillis?.() ?? 0) < 60000) throw new ApiError("Please wait a minute before sending another test.", 429);
      tx.update(userRef, { lastNotificationTestAt: Timestamp.now() });
      return recipient;
    });
    await sendEmail({ to, from: "Restok <alerts@getrestok.com>", ...buildTestNotificationEmail(), idempotencyKey: `test-${uid}-${Math.floor(Date.now() / 60000)}` });
    return Response.json({ success: true, to });
  } catch (error) { return apiError(error); }
}
