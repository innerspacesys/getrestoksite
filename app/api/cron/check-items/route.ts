import { createHash, timingSafeEqual } from "node:crypto";
import { Timestamp } from "@/lib/data/server";
import { adminDb } from "@/lib/auth/server";
import { resolveNotificationEmail, sendEmail } from "@/lib/email";
import { buildStockDigestEmail } from "@/lib/emailTemplates";
import { daysRemaining, needsReorder } from "@/lib/inventory";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Reminder job is not configured." }, { status: 503 });
  const supplied = Buffer.from(req.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  let emailsSent = 0;
  let failed = 0;
  const users = await adminDb.collection("users").get();
  for (const userDoc of users.docs) {
    const user = userDoc.data();
    if (!user.orgId || user.disabled || user.accountStatus === "deactivated" || user.emailNotifications === false || user.lowStockAlerts === false) continue;
    const to = resolveNotificationEmail(user);
    if (!to) continue;
    // Persist exact content so concurrent runs and retries share a provider idempotency key.
    const deliveryId = createHash("sha256").update(`${userDoc.id}:${user.orgId}:${day}`).digest("hex");
    const deliveryRef = adminDb.collection("notificationDeliveries").doc(deliveryId);
    try {
      const orgRef = adminDb.collection("organizations").doc(user.orgId);
      const org = (await orgRef.get()).data();
      if (!org || org.active === false) continue;
      let delivery = (await deliveryRef.get()).data();
      if (delivery?.sentAt) continue;
      if (!delivery) {
        const [items, vendors, locations] = await Promise.all([orgRef.collection("items").get(), orgRef.collection("vendors").get(), orgRef.collection("locations").get()]);
        const vendorNames = new Map(vendors.docs.map(d => [d.id, d.data().name]));
        const locationNames = new Map(locations.docs.map(d => [d.id, d.data().name]));
        const due = items.docs.map(d => d.data()).filter(item => needsReorder(item, now)).map(item => ({ name: String(item.name || "Supply"), daysLeft: daysRemaining(item, now)!, vendor: String(vendorNames.get(item.vendorId) || "No vendor"), location: String(locationNames.get(item.locationId) || "No location") })).sort((a, b) => a.daysLeft - b.daysLeft);
        if (!due.length) continue;
        const payload = { to, ...buildStockDigestEmail(String(org.name || "Your workspace"), due), createdAt: Timestamp.now() };
        await adminDb.runTransaction(async tx => {
          if (!(await tx.get(deliveryRef)).exists) tx.create(deliveryRef, payload);
        });
        delivery = (await deliveryRef.get()).data()!;
      }
      if (delivery.sentAt) continue;
      await sendEmail({ from: "Restok <alerts@getrestok.com>", to: delivery.to, subject: delivery.subject, html: delivery.html, text: delivery.text, idempotencyKey: `digest-${deliveryId}` });
      await deliveryRef.update({ sentAt: Timestamp.now() });
      emailsSent++;
    } catch (error) {
      failed++;
      console.error("Digest failed", userDoc.id, error);
    }
  }
  return Response.json({ success: failed === 0, emailsSent, failed, ranAt: new Date(now).toISOString() }, { status: failed ? 500 : 200 });
}
