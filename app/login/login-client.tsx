"use client";

import { useState } from "react";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const showSetupMessage = params.get("setup") === "1";

  function getErrorMessage(err: unknown) {
    return err instanceof Error ? err.message : "Failed to log in";
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10 md:px-6">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.18),transparent_40%)] dark:bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.16),transparent_36%)]" />
      <Link
        href="/"
        className="absolute left-4 top-4 text-sm font-medium text-sky-600 hover:underline dark:text-sky-300 md:left-6 md:top-6 md:text-base"
      >
        ← Back to Home
      </Link>

      <div className="surface-panel w-full max-w-md rounded-[30px] p-6 md:p-8">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-3xl bg-sky-100 text-2xl dark:bg-sky-950/50">
          🔐
        </div>
        <h1 className="text-center text-2xl font-bold text-slate-950 dark:text-slate-50">
          Log in
        </h1>
        <p className="mt-2 text-center text-slate-500 dark:text-slate-400">
          Access your Restok account
        </p>

        {showSetupMessage && (
          <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800">
            <strong>Account created successfully 🎉</strong>
            <p className="mt-1">
              We’ve sent you an email to set your password.
              <br />
              Please check your inbox and spam folder.
            </p>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-2xl bg-red-50 p-3 text-center text-red-600 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-300">Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-slate-600 dark:text-slate-300">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="button-primary w-full !rounded-2xl !py-3"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          Don’t have an account?
          <Link href="/signup" className="ml-1 text-sky-600 dark:text-sky-300">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
