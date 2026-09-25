import { getPool } from "@/lib/supabase/admin";
import { assertInternal, internalError } from "@/lib/internalApi";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { token } = await req.json();
    await assertInternal(token);

    const { rows } = await getPool().query(
      `select a.id, a.org_id, a.type, a.created_at, a.metadata, o.name as org_name
       from public.audit_logs a
       left join public.organizations o on o.id = a.org_id
       order by a.created_at desc
       limit 100`
    );

    return Response.json({
      events: rows.map((r) => ({
        id: r.id,
        orgId: r.org_id,
        orgName: r.org_name,
        type: r.type,
        createdAt: r.created_at,
        metadata: r.metadata || {},
      })),
    });
  } catch (error) {
    return internalError(error);
  }
}
