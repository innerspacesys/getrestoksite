"use client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
export class User {
 constructor(private source: SupabaseUser) {}
 get uid(): string { return this.source.app_metadata.restok_uid || this.source.id; }
 get email() { return this.source.email || null; }
 get displayName() { return this.source.user_metadata.display_name || this.source.user_metadata.full_name || null; }
 async getIdToken(force = false) {
   const { data,error } = force ? await getSupabase().auth.refreshSession() : await getSupabase().auth.getSession();
   if (error || !data.session) throw error || new Error("Please sign in again");
   return data.session.access_token;
 }
 async getIdTokenResult(force = false) {
   await this.getIdToken(force);
   const { data,error } = await getSupabase().auth.getUser(); if (error) throw error;
   return { claims: data.user?.app_metadata || {} };
 }
}
export const auth = {
 currentUser: null as User | null,
 onAuthStateChanged(callback: (user: User | null) => void) { return onAuthStateChanged(auth,callback); },
 async signOut() { return signOut(auth); },
};
export function onAuthStateChanged(_auth: typeof auth, callback: (user: User | null) => void) {
 const { data } = getSupabase().auth.onAuthStateChange((event,session) => {
   auth.currentUser = session?.user ? new User(session.user) : null;
   if (event === "TOKEN_REFRESHED") return;
   // Run user callbacks outside the auth lock (some callbacks refresh tokens).
   setTimeout(() => { if (!closed) callback(auth.currentUser); },0);
 });
 let closed = false;
 return () => { closed = true; data.subscription.unsubscribe(); };
}
export async function signInWithEmailAndPassword(_auth: typeof auth,email: string,password: string) {
 const { data,error } = await getSupabase().auth.signInWithPassword({ email,password }); if (error) throw error;
 const user = new User(data.user); auth.currentUser = user; return { user };
}
export async function signOut(_auth: typeof auth) { void _auth; const {error} = await getSupabase().auth.signOut(); if(error)throw error; auth.currentUser=null; }
export const EmailAuthProvider = { credential: (email: string,password: string) => ({email,password}) };
export async function reauthenticateWithCredential(user: User,credential: {email:string;password:string}) {
 if (user.email !== credential.email) throw new Error("Account mismatch");
 return signInWithEmailAndPassword(auth,credential.email,credential.password);
}
export async function updatePassword(_user: User,password: string) { const {error}=await getSupabase().auth.updateUser({password});if(error)throw error; }
export async function updateProfile(_user: User,profile: {displayName:string}) { const {error}=await getSupabase().auth.updateUser({data:{display_name:profile.displayName}});if(error)throw error; }
export async function deleteUser(user: User) {
 const response=await fetch("/api/auth/delete-account",{method:"POST",headers:{Authorization:`Bearer ${await user.getIdToken()}`}});
 const data=await response.json();if(!response.ok)throw new Error(data.error);await signOut(auth);
}
export async function startGoogleSignIn(returnPath: string) {
 if (!returnPath.startsWith("/") || returnPath.startsWith("//")) throw new Error("Invalid return path");
 sessionStorage.setItem("restok:oauth-pending","true");
 const {error}=await getSupabase().auth.signInWithOAuth({provider:"google",options:{redirectTo:`${window.location.origin}${returnPath}`,queryParams:{prompt:"select_account"}}});if(error)throw error;
}
export async function getRedirectResult(_auth: typeof auth) {
 void _auth;
 if (typeof window === "undefined" || !sessionStorage.getItem("restok:oauth-pending")) return null;
 const { data,error } = await getSupabase().auth.getSession(); if(error)throw error;
 sessionStorage.removeItem("restok:oauth-pending");
 if(!data.session)return null;
 const user=new User(data.session.user);auth.currentUser=user;return {user};
}
