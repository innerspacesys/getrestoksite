import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import { resolveNotificationEmail, sendEmail } from "@/lib/email";
import { buildStockAlertEmail } from "@/lib/emailTemplates";

export async function GET() {
  const now = new Date();
  let emailsSent = 0;

  const usersSnap = await adminDb.collection("users").get();

  for (const userDoc of usersSnap.docs) {
    const user = userDoc.data();

    if (!user?.email || !user?.orgId) continue;
    if (user.emailNotifications === false || user.lowStockAlerts === false) {
      continue;
    }

    const orgRef = adminDb.collection("organizations").doc(user.orgId);
    const orgSnap = await orgRef.get();
    const org = orgSnap.data();

    if (org?.active === false) continue;

    const itemsSnap = await orgRef.collection("items").get();
    const vendorsSnap = await orgRef.collection("vendors").get();
    const locationsSnap = await orgRef.collection("locations").get();
    const vendors = new Map(vendorsSnap.docs.map((doc) => [doc.id, doc.data()]));
    const locations = new Map(
      locationsSnap.docs.map((doc) => [doc.id, doc.data()])
    );

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

        const vendor =
          item.vendorId && typeof item.vendorId === "string"
            ? vendors.get(item.vendorId)
            : null;
        const location =
          item.locationId && typeof item.locationId === "string"
            ? locations.get(item.locationId)
            : null;
        const message = buildStockAlertEmail({
          itemName: item.name,
          daysLeft,
          orgName: org?.name || null,
          vendorName:
            vendor && typeof vendor.name === "string" ? vendor.name : null,
          locationName:
            location && typeof location.name === "string" ? location.name : null,
        });

        const to = resolveNotificationEmail(user);

        if (!to) {
          console.warn("Skipping user with no notification email", userDoc.id);
          continue;
        }

        await sendEmail({
          from: "Restok <alerts@getrestok.com>",
          to,
          subject: message.subject,
          html: message.html,
          text: message.text,
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
