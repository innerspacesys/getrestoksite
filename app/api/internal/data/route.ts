import { getPool } from "@/lib/supabase/admin";
import { assertInternal, internalError } from "@/lib/internalApi";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { token } = await req.json();
    await assertInternal(token);

    const { rows } = await getPool().query(
      `select
         o.id, o.name, o.plan, o.active, o.status, o.canceled_at, o.scheduled_deletion_at,
         o.created_at, o.stripe_customer_id, o.stripe_subscription_id,
         o.manual_plan_override, o.internal_notes, o.owner_id, o.beta,
         p.email as owner_email, p.name as owner_name, p.phone as owner_phone,
         p.disabled as owner_disabled, p.role as owner_role,
         u.last_sign_in_at,
         coalesce(ic.c, 0) as item_count,
         coalesce(vc.c, 0) as vendor_count,
         coalesce(lc.c, 0) as location_count,
         la.last_activity
       from public.organizations o
       left join public.profiles p on p.id = o.owner_id
       left join auth.users u on u.id = p.auth_user_id
       left join (select org_id, count(*)::int c from public.items group by org_id) ic on ic.org_id = o.id
       left join (select org_id, count(*)::int c from public.vendors group by org_id) vc on vc.org_id = o.id
       left join (select org_id, count(*)::int c from public.locations group by org_id) lc on lc.org_id = o.id
       left join (select org_id, max(at) last_activity from public.item_activity group by org_id) la on la.org_id = o.id
       order by o.created_at desc nulls last
       limit 500`
    );

    const orgs = rows.map((r) => ({
      orgId: r.id,
      orgName: r.name,
      plan: r.plan || "basic",
      active: r.active !== false,
      status: r.status || "active",
      canceledAt: r.canceled_at,
      scheduledDeletionAt: r.scheduled_deletion_at,
      createdAt: r.created_at,
      stripeCustomerId: r.stripe_customer_id,
      stripeSubscriptionId: r.stripe_subscription_id,
      manualPlanOverride: !!r.manual_plan_override,
      internalNotes: r.internal_notes || "",
      beta: !!r.beta,
      ownerId: r.owner_id,
      email: r.owner_email || "",
      name: r.owner_name || "Unknown",
      phone: r.owner_phone || "",
      disabled: !!r.owner_disabled,
      role: r.owner_role || "owner",
      lastSignInAt: r.last_sign_in_at,
      itemCount: r.item_count,
      vendorCount: r.vendor_count,
      locationCount: r.location_count,
      lastActivity: r.last_activity,
    }));

    return Response.json({ orgs });
  } catch (error) {
    return internalError(error);
  }
}
