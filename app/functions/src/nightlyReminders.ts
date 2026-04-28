import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

async function sendEmail(to: string, subject: string, body: string) {
  // Replace with your email system later
  console.log("EMAIL →", to, subject, body);
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
        `Time to restock ${item.name}.\n\nOpen Restok: https://getrestok.com/dashboard/restock`
      );

      await doc.ref.update({
        lastReminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
