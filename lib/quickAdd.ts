import { getSupabase } from "@/lib/supabase/client";

export type QuickAddRow = { id: string; name: string; daysLast: number };

export async function saveQuickAdd(orgId: string, rows: QuickAddRow[], actor: string | null) {
  const client = getSupabase();
  // One INSERT is atomic: a validation/plan-limit failure rolls back every row.
  // IDs survive retries, including when the database committed but the response was lost.
  const records = rows.map(row => ({
    id: row.id, org_id: orgId, name: row.name, days_last: row.daysLast,
    reminder_days: 3, created_by_name: actor, created_at: new Date().toISOString(),
  }));
  const { error } = await client.from("items").insert(records);
  if (!error) return;
  const { data, error: readError } = await client.from("items")
    .select("id,name,days_last").eq("org_id", orgId).in("id", rows.map(row => row.id));
  if (!readError && rows.every(row => data?.some(saved =>
    saved.id === row.id && saved.name === row.name && saved.days_last === row.daysLast))) return;
  throw new Error(error.message || "Couldn't save these items. Please retry.");
}
