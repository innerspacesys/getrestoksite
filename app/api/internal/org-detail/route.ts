import { getPool } from "@/lib/supabase/admin";
import { assertInternal, internalError, InternalError } from "@/lib/internalApi";

export const dynamic = "force-dynamic";

// Read-only snapshot of a workspace for support ("view as"). Service-role reads,
// so it works regardless of the admin's own RLS scope; it never mutates anything.
export async function POST(req: Request) {
  try {
    const { token, orgId } = await req.json();
    await assertInternal(token);
    if (typeof orgId !== "string" || !orgId) throw new InternalError("Missing orgId");

    const pool = getPool();
    const [items, vendors, locations, members, activity] = await Promise.all([
      pool.query(
        `select id, name, days_last, reminder_days, created_at, last_restocked_at,
                order_status, snoozed_until, vendor_id, location_id
         from public.items where org_id = $1 order by name`,
        [orgId]
      ),
      pool.query("select id, name, email, website from public.vendors where org_id = $1 order by name", [orgId]),
      pool.query("select id, name, is_department from public.locations where org_id = $1 order by name", [orgId]),
      pool.query("select id, email, name, role, disabled from public.profiles where org_id = $1 order by role", [orgId]),
      pool.query(
        "select id, item_name, action, at, actor_name from public.item_activity where org_id = $1 order by at desc limit 20",
        [orgId]
      ),
    ]);

    return Response.json({
      items: items.rows.map((r) => ({
        id: r.id,
        name: r.name,
        daysLast: r.days_last,
        reminderDays: r.reminder_days,
        createdAt: r.created_at,
        lastRestockedAt: r.last_restocked_at,
        orderStatus: r.order_status,
        snoozedUntil: r.snoozed_until,
        vendorId: r.vendor_id,
        locationId: r.location_id,
      })),
      vendors: vendors.rows,
      locations: locations.rows,
      members: members.rows,
      activity: activity.rows.map((r) => ({
        id: r.id,
        itemName: r.item_name,
        action: r.action,
        at: r.at,
        actorName: r.actor_name,
      })),
    });
  } catch (error) {
    return internalError(error);
  }
}
