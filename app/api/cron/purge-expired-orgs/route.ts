import { randomUUID, timingSafeEqual } from "node:crypto";
import { getPool } from "@/lib/supabase/admin";
import { adminAuth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Permanently delete workspaces that have been canceled past their retention
// deadline (scheduled_deletion_at, set 30 days after cancellation by the Stripe
// webhook). Deleting the organization row cascades to its items, vendors,
// locations, and activity; member profiles and auth accounts are removed too.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Purge job is not configured." }, { status: 503 });
  const supplied = Buffer.from(req.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPool();
  // Only inactive workspaces whose deletion deadline has elapsed. Capped per run
  // as a safety valve against an unexpected backlog.
  const { rows: orgs } = await pool.query<{ id: string; name: string | null }>(
    `select id, name from public.organizations
     where active = false
       and scheduled_deletion_at is not null
       and scheduled_deletion_at < now()
     order by scheduled_deletion_at asc
     limit 25`
  );

  let purged = 0;
  let failed = 0;

  for (const org of orgs) {
    const client = await pool.connect();
    try {
      // Capture members before the org row (and its ON DELETE SET NULL on
      // profiles) is gone.
      const { rows: members } = await client.query<{ auth_user_id: string | null }>(
        "select auth_user_id from public.profiles where org_id = $1",
        [org.id]
      );

      // Remove auth accounts (best effort — each belongs only to this workspace).
      let authFailures = 0;
      for (const member of members) {
        if (!member.auth_user_id) continue;
        try {
          await adminAuth.deleteUser(member.auth_user_id);
        } catch (error) {
          authFailures++;
          console.error("purge: auth delete failed", org.id, error);
        }
      }

      // Atomically record the purge, remove member profiles, and delete the org
      // (cascading items, vendors, locations, and item activity).
      await client.query("begin");
      await client.query(
        `insert into public.audit_logs(id, org_id, type, metadata)
         values ($1, $2, 'org_purged', $3)`,
        [
          randomUUID(),
          org.id,
          JSON.stringify({
            name: org.name,
            members: members.length,
            authFailures,
            purgedAt: new Date().toISOString(),
          }),
        ]
      );
      await client.query("delete from public.profiles where org_id = $1", [org.id]);
      await client.query("delete from public.organizations where id = $1", [org.id]);
      await client.query("commit");

      purged++;
      console.log("🗑️ Purged expired workspace", org.id, `(${members.length} members)`);
    } catch (error) {
      await client.query("rollback").catch(() => {});
      failed++;
      console.error("purge: failed to delete org", org.id, error);
    } finally {
      client.release();
    }
  }

  return Response.json(
    { success: failed === 0, scanned: orgs.length, purged, failed, ranAt: new Date().toISOString() },
    { status: failed ? 500 : 200 }
  );
}
