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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 md:p-6 relative">
      <Link
        href="/"
        className="absolute top-4 left-4 md:top-6 md:left-6 text-sky-600 font-medium hover:underline"
      >
        ← Back to Home
      </Link>

      <div className="w-full max-w-md bg-white rounded-2xl shadow p-6 md:p-8">
        <h1 className="text-2xl font-bold text-center">Log in</h1>
        <p className="text-slate-500 text-center mt-2">
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
          <p className="text-red-600 text-center mt-3 bg-red-50 p-2 rounded">
            {error}
          </p>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-slate-600">Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-slate-600">Password</label>
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
            className="w-full bg-sky-600 text-white p-3 rounded-lg font-medium hover:opacity-95"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          Don’t have an account?
          <Link href="/signup" className="text-sky-600 ml-1">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
