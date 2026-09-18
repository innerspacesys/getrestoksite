import "server-only";
import type { User } from "@supabase/supabase-js";
import { getPool, getSupabaseAdmin } from "@/lib/supabase/admin";
export { adminDb } from "@/lib/data/server";
function record(user: User) { return { uid: String(user.app_metadata.restok_uid || user.id), email: user.email, displayName: user.user_metadata.display_name || user.user_metadata.full_name || "", disabled: Boolean(user.banned_until && Date.parse(user.banned_until)>Date.now()) }; }
async function authId(uid: string) {
 const {rows}=await getPool().query("select id from auth.users where id::text=$1 or raw_app_meta_data->>'restok_uid'=$1 limit 1",[uid]);
 if(!rows.length)throw new Error("User not found");return rows[0].id as string;
}
export const adminAuth = {
 async verifyIdToken(token: string, _checkRevoked = true) {
   void _checkRevoked;
   const {data,error}=await getSupabaseAdmin().auth.getUser(token);
   if(error || !data.user)throw new Error("Invalid or expired session");
   const user=record(data.user);
   const {rows}=await getPool().query("select disabled,account_status,internal_admin from public.profiles where auth_user_id=$1",[data.user.id]);
   if(user.disabled || rows[0]?.disabled || rows[0]?.account_status === "deactivated")throw new Error("Account deactivated");
   return { ...user, name:user.displayName, internalAdmin: rows[0]?.internal_admin === true, exp: Math.floor(Date.now()/1000)+3600 };
 },
 async getUser(uid:string) {const {data,error}=await getSupabaseAdmin().auth.admin.getUserById(await authId(uid));if(error)throw error;return record(data.user);},
 async getUserByEmail(email:string) {
   const {rows}=await getPool().query("select id from auth.users where lower(email)=lower($1) limit 1",[email]);
   if(!rows.length)throw new Error("User not found");
   const {data,error}=await getSupabaseAdmin().auth.admin.getUserById(rows[0].id);if(error)throw error;return record(data.user);
 },
 async createUser(options: {email:string;password?:string;displayName?:string;disabled?:boolean}) {
   const {data,error}=await getSupabaseAdmin().auth.admin.createUser({email:options.email,password:options.password,email_confirm:true,user_metadata:{display_name:options.displayName || ""},ban_duration:options.disabled ? "876000h" : undefined});
   if(error)throw error;return record(data.user);
 },
 async updateUser(uid:string,options:{password?:string;disabled?:boolean;displayName?:string}) {
   const {data,error}=await getSupabaseAdmin().auth.admin.updateUserById(await authId(uid),{...(options.password ? {password:options.password} : {}),...(options.disabled !== undefined ? {ban_duration:options.disabled ? "876000h" : "none"} : {}),...(options.displayName !== undefined ? {user_metadata:{display_name:options.displayName}} : {})});
   if(error)throw error;return record(data.user);
 },
 async revokeRefreshTokens(uid:string) { await getPool().query("delete from auth.sessions where user_id=$1",[await authId(uid)]); },
 async deleteUser(uid:string) {const {error}=await getSupabaseAdmin().auth.admin.deleteUser(await authId(uid));if(error)throw error;},
};
