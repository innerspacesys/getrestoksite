import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Pool } from "pg";
let client: SupabaseClient | undefined;
let pool: Pool | undefined;
export function getSupabaseAdmin() {
 if (!process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Supabase server configuration is missing");
 return client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function getPool() {
 if (!process.env.SUPABASE_DB_URL) throw new Error("Supabase database connection is missing");
 return pool ??= new Pool({ connectionString: process.env.SUPABASE_DB_URL, max: 3, idleTimeoutMillis: 20000, connectionTimeoutMillis: 10000 });
}
