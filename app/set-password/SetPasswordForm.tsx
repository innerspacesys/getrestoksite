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
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Validating secure link…
      </div>
    );
  }

  // --------------------------
  // UI: Invalid / expired token
  // --------------------------
  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white p-8 rounded-xl shadow max-w-md w-full text-center">
          <h1 className="text-2xl font-bold">Link expired</h1>
          <p className="text-slate-600 mt-2 text-sm">
            This password setup link is invalid or has expired.
          </p>

          <Link
            href="/login"
            className="inline-block mt-6 bg-sky-600 text-white px-6 py-3 rounded-lg"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 md:p-8 rounded-xl shadow max-w-md w-full"
      >
        <h1 className="text-2xl font-bold text-center">
          Set your password
        </h1>

        <p className="text-sm text-slate-500 text-center mt-2">
          Finish setting up your Restok account
        </p>

        {error && (
          <div className="mt-4 text-sm bg-red-100 text-red-700 p-2 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 text-sm bg-green-100 text-green-700 p-2 rounded">
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

        <p className="text-xs text-slate-500 mt-2">
          Password must be at least 6 characters.
        </p>

        <button
          disabled={loading}
          className="mt-4 w-full bg-sky-600 text-white py-3 rounded-lg disabled:bg-slate-400"
        >
          {loading ? "Saving..." : "Set Password"}
        </button>
      </form>
    </div>
  );
}
