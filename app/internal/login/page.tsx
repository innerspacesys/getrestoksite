"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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

  // If already signed in & internal, redirect immediately
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCheckingAuth(false);
        return;
      }

      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.data() as { internalAdmin?: boolean } | undefined;

      if (data?.internalAdmin) {
        router.push("/internal");
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

      router.push("/internal");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }

    setLoading(false);
  }

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-12 w-12 border-4 border-sky-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <main className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="bg-white p-8 rounded-xl border shadow-sm w-full max-w-md">
        <h1 className="text-2xl font-bold">
          Internal Admin Login
        </h1>

        <p className="text-sm text-slate-500 mt-1">
          Private Restok staff access
        </p>

        {error && (
          <div className="mt-4 bg-red-100 text-red-700 px-4 py-2 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <input
            type="email"
            className="input w-full border rounded px-3 py-2"
            placeholder="Admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            className="input w-full border rounded px-3 py-2"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            disabled={loading}
            className="w-full bg-sky-600 hover:bg-sky-700 text-white py-2 rounded-lg"
          >
            {loading ? "Signing in…" : "Log In"}
          </button>
        </form>
      </div>
    </main>
  );
}
