"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PLANS } from "@/lib/plans";
import TurnstileWidget from "@/components/TurnstileWidget";
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function SignupPage() {
  const router = useRouter();
  const params = useSearchParams();
  const rawPlan = params.get("plan");
  const planKey = rawPlan ? rawPlan.toLowerCase().trim() : null;
  const initialPlan: keyof typeof PLANS =
    planKey && planKey in PLANS
      ? (planKey as keyof typeof PLANS)
      : "basic";

  const [selectedPlan, setSelectedPlan] =
    useState<keyof typeof PLANS>(initialPlan);
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const [googleAuthToken, setGoogleAuthToken] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);
  const [existingAccountMessage, setExistingAccountMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  function getErrorMessage(err: unknown) {
    return err instanceof Error ? err.message : "Signup failed";
  }

  const checkExistingAccount = useCallback(async (emailToCheck: string) => {
    const res = await fetch("/api/auth/account-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailToCheck }),
    });

    const data = (await res.json()) as {
      exists?: boolean;
      hasWorkspace?: boolean;
      error?: string;
    };

    if (!res.ok) {
      throw new Error(data.error || "Failed to check account status");
    }

    return data;
  }, []);

  const applyGoogleUser = useCallback(async (user: typeof auth.currentUser) => {
    if (!user) return;

    const resolvedEmail = user.email || "";
    if (resolvedEmail) {
      const status = await checkExistingAccount(resolvedEmail);

      if (status.hasWorkspace) {
        setExistingAccountMessage(
          "We found an existing Restok account for this email. Please log in instead of starting a new signup."
        );
        setGoogleConnected(false);
        setGoogleAuthToken("");
        await signOut(auth);
        router.push(`/login?email=${encodeURIComponent(resolvedEmail)}`);
        return;
      }
    }

    const token = await user.getIdToken(true);
    setGoogleAuthToken(token);
    setGoogleConnected(true);
    setExistingAccountMessage("");
    setEmail((current) => current || resolvedEmail);
    setName((current) => current || user.displayName || "");
  }, [checkExistingAccount, router]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        setGoogleConnected(false);
        setGoogleAuthToken("");
        return;
      }

      applyGoogleUser(user).catch((err: unknown) => {
        setError(getErrorMessage(err));
      });
    });

    getRedirectResult(auth)
      .then(async (result) => {
        if (!result?.user) return;
        await applyGoogleUser(result.user);
      })
      .catch((err: unknown) => {
        setError(getErrorMessage(err));
      });

    return () => unsub();
  }, [applyGoogleUser]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (turnstileEnabled && !turnstileToken) {
        throw new Error("Please complete the security check.");
      }

      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          orgName,
          phone,
          plan: selectedPlan,
          interval,
          turnstileToken,
          authToken: googleAuthToken || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error?.toLowerCase().includes("captcha")) {
          setTurnstileToken("");
          setTurnstileResetSignal((current) => current + 1);
        }
        throw new Error(data.error || "Failed to start checkout");
      }

      window.location.href = data.url;
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setError("");
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        await signInWithRedirect(auth, provider);
        return;
      }

      const result = await signInWithPopup(auth, provider);
      await applyGoogleUser(result.user);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen px-4 pb-10 pt-5 md:px-6 md:pb-0 md:pt-0">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.18),transparent_40%)] dark:bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.16),transparent_36%)]" />

      <Link
        href="/"
        className="absolute left-4 top-5 z-10 text-sm font-medium text-sky-600 hover:underline dark:text-sky-300 md:left-6 md:top-6 md:text-base"
      >
        ← Back to Home
      </Link>

      <div className="flex min-h-screen items-start justify-center pt-16 md:items-center md:pt-0">
        <div className="surface-panel w-full max-w-md rounded-[30px] p-5 md:p-8">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-3xl bg-sky-100 text-2xl dark:bg-sky-950/50">
            ✨
          </div>

          <h1 className="text-center text-2xl font-bold leading-tight text-slate-950 dark:text-slate-50 md:text-3xl">
            Create your account
          </h1>

          <p className="mt-2 text-center text-sm text-zinc-500 dark:text-slate-400">
            Plan selected:{" "}
            <span className="font-medium capitalize">
              {PLANS[selectedPlan].name} -{" "}
              {interval === "monthly" ? "Monthly" : "Yearly"}
            </span>
          </p>

          {googleConnected && (
            <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
              Google account connected for signup. We&apos;ll use that account
              after payment instead of sending a password setup email.
            </div>
          )}

          {existingAccountMessage && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              {existingAccountMessage}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-2xl bg-red-100 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="mt-6">
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={loading}
              className="button-secondary w-full !rounded-2xl !py-3 text-sm"
            >
              <span className="mr-2 text-base">G</span>
              {googleConnected ? "Google account connected" : "Start with Google"}
            </button>
            {googleConnected && (
              <button
                type="button"
                onClick={async () => {
                  await signOut(auth);
                  setGoogleConnected(false);
                  setGoogleAuthToken("");
                }}
                className="mt-3 w-full text-center text-xs text-slate-500 hover:underline dark:text-slate-400"
              >
                Use a different Google account
              </button>
            )}
          </div>

          <form onSubmit={handleSignup} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-slate-300">
                Plan
              </label>
              <select
                value={selectedPlan}
                onChange={(e) =>
                  setSelectedPlan(e.target.value as keyof typeof PLANS)
                }
                className="input"
              >
                <option value="basic">Basic — 5 items</option>
                <option value="pro">Pro — 10 items/2 users</option>
                <option value="premium">
                  Premium — Unlimited items/users/locations
                </option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-slate-300">
                Billing Cycle
              </label>
              <select
                value={interval}
                onChange={(e) =>
                  setInterval(e.target.value as "monthly" | "yearly")
                }
                className="input"
              >
                <option value="monthly">Monthly — billed every month</option>
                <option value="yearly">Yearly — billed annually</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-slate-300">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-slate-300">
                Organization Name
              </label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-slate-300">
                Phone Number
              </label>
              <input
                type="tel"
                required
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-slate-300">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="button-primary w-full !rounded-2xl !py-3 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Loading..." : "Continue to Payment"}
            </button>
          </form>

          <div className="mt-4">
            <TurnstileWidget
              onVerify={setTurnstileToken}
              onExpire={() => setTurnstileToken("")}
              resetSignal={turnstileResetSignal}
            />
          </div>

          <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
            If Google does not provide everything we need, just fill in the
            missing fields above before continuing to payment.
          </p>

          <p className="mt-4 text-center text-sm text-zinc-600 dark:text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="text-sky-600 hover:underline dark:text-sky-300">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
