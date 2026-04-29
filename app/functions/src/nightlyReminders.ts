import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

async function sendEmail(to: string, subject: string, itemName: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY is missing; skipping reminder email.");
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Restok <alerts@getrestok.com>",
      to,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;background:#f3f8fc;padding:24px;">
          <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dbe7f2;border-radius:24px;padding:28px;">
            <div style="font-size:28px;font-weight:800;color:#0f172a;">Restok</div>
            <h1 style="font-size:28px;line-height:1.15;color:#0f172a;margin:20px 0 12px;">A reminder is ready</h1>
            <p style="font-size:16px;line-height:1.7;color:#475569;margin:0 0 18px;">
              ${itemName} is ready for review in Restok.
            </p>
            <a href="https://getrestok.com/dashboard/restock" style="display:inline-block;background:#0284c7;color:#fff;text-decoration:none;padding:14px 22px;border-radius:16px;font-weight:700;">Open Restok</a>
          </div>
        </div>
      `,
      text: `Restok reminder: ${itemName}\n\nOpen Restok: https://getrestok.com/dashboard/restock`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend failed: ${response.status} ${errorText}`);
  }
}

export const nightlyReminderJob = functions.scheduler
  .onSchedule("every day 02:00", async () => {
    const now = admin.firestore.Timestamp.now();

    const snap = await db
      .collectionGroup("items")
      .where("nextReminderAt", "<=", now)
      .get();

    for (const doc of snap.docs) {
      const item = doc.data();
      const pathParts = doc.ref.path.split("/");
      const userId = pathParts[1];

      const userSnap = await db.doc(`users/${userId}`).get();
      if (!userSnap.exists) continue;

      const user = userSnap.data()!;
      if (user.emailNotifications === false) continue;

      if (
        item.lastReminderSentAt &&
        now.toMillis() - item.lastReminderSentAt.toMillis() < 2 * 86400000
      ) {
        continue;
      }

      await sendEmail(
        user.email,
        `⏰ Restok reminder: ${item.name}`,
        item.name
      );

      await doc.ref.update({
        lastReminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
