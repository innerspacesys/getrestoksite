"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TurnstileWidget from "@/components/TurnstileWidget";
import { getSupabase } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [resetSignal, setResetSignal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (value) {
      setToken(value);
      window.history.replaceState(null,"",window.location.pathname);
    }
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (token) {
        if (password.length < 8 || password !== confirm) throw new Error("Use at least 8 characters and make sure both passwords match.");
        if (!verified) {
          const result = await getSupabase().auth.verifyOtp({ token_hash: token, type: "recovery" });
          if (result.error) throw new Error("This reset link has expired or has already been used. Request a new one.");
          setVerified(true);
        }
        const result = await getSupabase().auth.updateUser({ password });
        if (result.error) throw result.error;
        await getSupabase().auth.signOut();
        setMessage("Your password has been updated. You can now log in.");
      } else {
        const response = await fetch("/api/auth/reset-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,turnstileToken:captcha})});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to send reset link.");
        setMessage("If an active account uses that email, a reset link is on its way. Check your inbox and spam folder.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
      setCaptcha(""); setResetSignal(value => value + 1);
    } finally { setBusy(false); }
  }
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
    <h1 className="text-3xl font-semibold">Reset your password</h1>
    <p className="mt-3 text-sm text-slate-500">{token ? "Choose a new password for your Restok account." : "Enter your login email. Your supplies and workspace will stay the same."}</p>
    {message ? <p role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-emerald-900">{message}</p> : <form onSubmit={submit} className="mt-6 space-y-4">
      {token ? <>
        <label className="block">New password<input className="input" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label className="block">Confirm password<input className="input" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
      </> : <>
        <label className="block">Login email<input className="input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <TurnstileWidget onVerify={setCaptcha} onExpire={() => setCaptcha("")} resetSignal={resetSignal} />
      </>}
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <button className="button-primary w-full" disabled={busy}>{busy ? "Please wait…" : token ? "Save password" : "Send reset link"}</button>
    </form>}
    <Link className="mt-5 text-sky-600" href="/login">Back to login</Link>
  </main>;
}
