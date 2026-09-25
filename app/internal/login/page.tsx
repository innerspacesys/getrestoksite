"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/auth/client";
import { db } from "@/lib/data/client";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "@/lib/auth/client";
import { doc, getDoc } from "@/lib/data/client";
import { useRouter } from "next/navigation";

export default function InternalLogin() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function getErrorMessage(err: unknown) {
    return err instanceof Error ? err.message : "Login failed";
  }

  // If already signed in & internal, redirect immediately.
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCheckingAuth(false);
        return;
      }

      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.data() as { internalAdmin?: boolean } | undefined;

      if (data?.internalAdmin) {
        router.push("/");
      } else {
        await signOut(auth);
        setError("You are not authorized to access this panel.");
      }

      setCheckingAuth(false);
    });
  }, [router]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signInWithEmailAndPassword(auth, email, password);

      const snap = await getDoc(doc(db, "users", res.user.uid));
      const data = snap.data() as { internalAdmin?: boolean } | undefined;

      if (!data?.internalAdmin) {
        await signOut(auth);
        setError("Access denied. Internal admins only.");
        setLoading(false);
        return;
      }

      router.push("/");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }

    setLoading(false);
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="surface-panel w-full max-w-md rounded-[28px] p-8 shadow-2xl">
        <span className="eyebrow">Staff access</span>
        <h1 className="mt-4 text-2xl font-bold">Internal Admin Login</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Private Restok staff access
        </p>

        {error && (
          <div className="mt-4 rounded-2xl bg-red-100 px-4 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <input
            type="email"
            className="input"
            placeholder="Admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            className="input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button disabled={loading} className="button-primary w-full disabled:opacity-60">
            {loading ? "Signing in…" : "Log in"}
          </button>
        </form>
      </div>
    </main>
  );
}
