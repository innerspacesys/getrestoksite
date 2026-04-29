"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

export default function SetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();

  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function getErrorMessage(err: unknown) {
    return err instanceof Error ? err.message : "Failed to set password";
  }

  // --------------------------
  // Validate token on load
  // --------------------------
  useEffect(() => {
    async function check() {
      if (!token) {
        setTokenValid(false);
        setValidating(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/validate-password-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        await res.json();
        setTokenValid(res.ok);
      } catch {
        setTokenValid(false);
      }

      setValidating(false);
    }

    check();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6)
      return setError("Password must be at least 6 characters");

    if (password !== confirm)
      return setError("Passwords do not match");

    try {
      setLoading(true);

      const res = await fetch("/api/auth/complete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to set password");

      setSuccess(true);
      setTimeout(() => router.push("/login"), 1200);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  // --------------------------
  // UI: Loading token check
  // --------------------------
  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-slate-600 dark:text-slate-300">
        Validating secure link…
      </div>
    );
  }

  // --------------------------
  // UI: Invalid / expired token
  // --------------------------
  if (!tokenValid) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="surface-panel w-full max-w-md rounded-[30px] p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-950 dark:text-slate-50">Link expired</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            This password setup link is invalid or has expired.
          </p>

          <Link
            href="/login"
            className="button-primary mt-6 !rounded-2xl !px-6 !py-3"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.18),transparent_40%)] dark:bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.16),transparent_36%)]" />
      <form
        onSubmit={handleSubmit}
        className="surface-panel w-full max-w-md rounded-[30px] p-6 md:p-8"
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-3xl bg-sky-100 text-2xl dark:bg-sky-950/50">
          🔑
        </div>
        <h1 className="text-center text-2xl font-bold text-slate-950 dark:text-slate-50">
          Set your password
        </h1>

        <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
          Finish setting up your Restok account
        </p>

        {error && (
          <div className="mt-4 rounded-2xl bg-red-100 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-2xl bg-green-100 p-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-200">
            Password saved. Redirecting…
          </div>
        )}

        <input
          type="password"
          required
          minLength={6}
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input mt-6"
        />

        <input
          type="password"
          required
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="input mt-3"
        />

        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Password must be at least 6 characters.
        </p>

        <button
          disabled={loading}
          className="button-primary mt-4 w-full !rounded-2xl !py-3 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Saving..." : "Set Password"}
        </button>
      </form>
    </div>
  );
}
