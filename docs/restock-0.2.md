# Restok 0.2 — supply workflow update

- Settings → Notifications: optional per-user notification email. Blank uses the sign-in email. Account/password emails are unchanged. Save before using the rate-limited test button.
- Items: configurable reminder lead time (0–365 days). Existing items default to 3 days.
- Dashboard: due/overdue supplies, upcoming reorders and pending deliveries appear before the timeline.
- Items, Restock and Dashboard: record an order, cancel its pending status, or confirm supplies received. Recording an order does not place one with a vendor. Pending orders pause reorder emails; their remaining-stock estimate stays visible.
- Receiving preserves `createdAt`, writes `lastRestockedAt`, and restarts the countdown. Concurrent/stale receive requests return a conflict instead of resetting twice.
- Activity is stored under `organizations/{orgId}/items/{itemId}/activity`; authenticated API routes scope all requests to the caller's active organization. UI shows the latest 50 events. Historical events are not backfilled.
- Daily cron sends one digest per eligible user, excluding pending orders and inactive accounts/workspaces. Existing notification opt-outs are respected. Exact message content and delivery status are saved in `notificationDeliveries`; Resend idempotency keys protect retries and concurrent sends.

## Deployment

Existing Firebase Admin, Firebase public configuration and Resend variables are required. `CRON_SECRET` must be configured in Vercel; the cron endpoint now validates its Bearer authorization and fails closed if the secret is absent. The schedule stays at 14:00 UTC daily. New collections are accessed by the Admin SDK; no new client Firestore permissions or indexes are needed. Keep delivery records server-only in Firestore rules.

## Verification

Run `node --test tests/restock.test.cjs`, `npm run lint`, and `npm run build`. On the site, save an alternate email, send a test, edit an item's reminder window, mark it ordered, then mark it received and inspect its history. Clearing the alternate email restores sign-in-email routing.
