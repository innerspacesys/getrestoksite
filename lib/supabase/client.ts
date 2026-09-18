"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | undefined;
export function getSupabase() {
 if (!client) client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zzronpsjosajfxutnfzp.supabase.co", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "build-only-unconfigured", { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
 return client;
}
