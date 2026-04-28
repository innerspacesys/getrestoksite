import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { Resend } from "resend";
import { Timestamp } from "firebase-admin/firestore";
import { resolveNotificationEmail } from "@/lib/email";

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  return new Resend(process.env.RESEND_API_KEY);
}

export async function GET() {
  const now = new Date();
  let emailsSent = 0;
  const resend = getResend();

  const usersSnap = await adminDb.collection("users").get();

  for (const userDoc of usersSnap.docs) {
    const user = userDoc.data();

    if (!user?.email || !user?.orgId) continue;

    const itemsSnap = await adminDb
      .collection("organizations")
      .doc(user.orgId)
      .collection("items")
      .get();

    for (const itemDoc of itemsSnap.docs) {
      try {
        const item = itemDoc.data();
        if (!item?.createdAt || !item?.daysLast) continue;

        const created = item.createdAt.toDate();
        const diffDays = Math.floor(
          (now.getTime() - created.getTime()) / 86400000
        );

        const daysLeft = item.daysLast - diffDays;

        // Only alert if <= 3 days remaining
        if (daysLeft > 3) continue;

        // OPTIONAL duplicate prevention (commented intentionally)
        // const lastAlert = item.lastAlertSentAt?.toDate?.();
        // if (lastAlert) {
        //   const hoursSince =
        //     (now.getTime() - lastAlert.getTime()) / 3600000;
        //   if (hoursSince < 24) continue;
        // }

        const subject =
          daysLeft <= 0
            ? `🚨 ${item.name} may be OUT`
            : `⚠️ ${item.name} may be running low`;

        const html = `
<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background-color:#f1f5f9;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9; padding:32px 0;">
      <tr>
        <td align="center">
          <table width="520" cellpadding="0" cellspacing="0"
            style="background-color:#ffffff; border-radius:12px; padding:24px;
              font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
              box-shadow:0 10px 25px rgba(0,0,0,0.06);">
            <tr><td>

              <div style="text-align:center; margin-bottom:20px;">
                <img src="https://getrestok.com/logo.png"
                  alt="Restok" width="120"
                  style="display:block; margin:0 auto;" />
              </div>

              <h1 style="margin:0 0 8px 0; font-size:22px; color:#0f172a;">
                ${daysLeft <= 0 ? "🚨 Item May Be Out of Stock" : "⚠️ Item May Be Running Low"}
              </h1>

              <p style="margin:0 0 20px 0; font-size:15px; color:#475569;">
                This is a restock alert from <strong>Restok</strong>.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0"
                style="
                  background-color:${daysLeft <= 0 ? "#fee2e2" : "#fef3c7"};
                  border:1px solid ${daysLeft <= 0 ? "#fecaca" : "#fde68a"};
                  border-radius:10px;
                  padding:16px;
                  margin-bottom:20px;">
                <tr><td>

                  <p style="margin:0; font-size:16px; font-weight:600; color:#0f172a;">
                    ${item.name}
                  </p>

                  <p style="margin:6px 0 0 0; font-size:14px; color:#7c2d12;">
                    ${
                      daysLeft <= 0
                        ? "This item may have run out and may need restocking."
                        : `This item may run out in <strong>${daysLeft} days</strong>.`
                    }
                  </p>

                </td></tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td align="center">
                  <a href="https://getrestok.com/dashboard/restock"
                    style="display:inline-block; width:100%; background-color:#0ea5e9;
                      color:#ffffff; text-decoration:none; padding:14px 0;
                      border-radius:8px; font-weight:600; font-size:15px;
                      text-align:center;">
                    Review & Restock Items
                  </a>
                </td></tr>
              </table>

              <p style="margin-top:20px; font-size:12px; color:#64748b; text-align:center;">
                You’re receiving this email because you use Restok to track items you rely on.<br/>
                © ${new Date().getFullYear()} Restok
              </p>

            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
        `;

        const to = resolveNotificationEmail(user);

if (!to) {
  console.warn("Skipping user with no notification email", userDoc.id);
  continue;
}

        await resend.emails.send({
          from: "Restok <alerts@getrestok.com>",
          to,
          subject,
          html,
        });

        await itemDoc.ref.update({
          lastAlertSentAt: Timestamp.now(),
        });

        emailsSent++;
      } catch (err) {
        console.error("Failed on item", itemDoc.id, err);
      }
    }
  }

  return NextResponse.json({
    success: true,
    emailsSent,
    ranAt: now.toISOString(),
  });
}
