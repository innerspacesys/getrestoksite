"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import { finalizeClientSignIn } from "@/lib/clientAuth";
import TurnstileWidget from "@/components/TurnstileWidget";

export default function LoginClient() {
  const redirectTokenStorageKey = "restok:turnstile-token";
  const router = useRouter();
  const params = useSearchParams();
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const showSetupMessage = params.get("setup") === "1";
  const prefillsEmail = params.get("email") || "";
  const showDeactivatedNotice = params.get("status") === "deactivated";

  function getErrorMessage(err: unknown) {
    return err instanceof Error ? err.message : "Failed to log in";
  }

  const getAccountStatus = useCallback(async (emailToCheck: string) => {
    const res = await fetch("/api/auth/account-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailToCheck }),
    });

    return (await res.json().catch(() => null)) as
      | {
          disabled?: boolean;
          accountStatus?: string;
          scheduledDeletionAt?: string | null;
        }
      | null;
  }, []);

  const buildDeactivatedMessage = useCallback((scheduledDeletionAt?: string | null) => {
    let daysRemaining = 30;

    if (scheduledDeletionAt) {
      const diff = Math.ceil(
        (new Date(scheduledDeletionAt).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      );

      if (Number.isFinite(diff) && diff > 0) {
        daysRemaining = diff;
      }
    }

    return `This account has been deactivated and no longer has access to a Restok workspace. To keep using this account, start your own subscription or ask an admin to re-add you. Otherwise, this account may be deleted in about ${daysRemaining} days.`;
  }, []);

  const resolveLoginError = useCallback(async (err: unknown) => {
    const code =
      typeof err === "object" && err && "code" in err
        ? String((err as { code?: string }).code)
        : "";

    if (code === "auth/user-disabled" && email) {
      const status = await getAccountStatus(email);

      if (status?.disabled || status?.accountStatus === "deactivated") {
        return buildDeactivatedMessage(status.scheduledDeletionAt);
      }
    }

    return getErrorMessage(err);
  }, [buildDeactivatedMessage, email, getAccountStatus]);

  function requireTurnstileToken() {
    if (turnstileEnabled && !turnstileToken) {
      throw new Error("Please complete the security check.");
    }
  }

  function resetTurnstileChallenge() {
    setTurnstileToken("");
    setTurnstileResetSignal((current) => current + 1);
  }

  useEffect(() => {
    if (prefillsEmail) {
      setEmail(prefillsEmail);
    }
  }, [prefillsEmail]);

  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result?.user) return;

        setLoading(true);
        setError("");

        const pendingTurnstileToken =
          window.sessionStorage.getItem(redirectTokenStorageKey) || undefined;

        await finalizeClientSignIn(result.user, {
          turnstileToken: pendingTurnstileToken,
        });
        window.sessionStorage.removeItem(redirectTokenStorageKey);
        router.push("/dashboard");
      })
      .catch((err: unknown) => {
        window.sessionStorage.removeItem(redirectTokenStorageKey);
        resetTurnstileChallenge();
        void resolveLoginError(err).then(setError);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [resolveLoginError, router]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      requireTurnstileToken();
      const result = await signInWithEmailAndPassword(auth, email, password);
      await finalizeClientSignIn(result.user, {
        turnstileToken: turnstileToken || undefined,
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      if (getErrorMessage(err).toLowerCase().includes("captcha")) {
        resetTurnstileChallenge();
      }
      setError(await resolveLoginError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setLoading(true);

    try {
      requireTurnstileToken();

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        window.sessionStorage.setItem(redirectTokenStorageKey, turnstileToken);
        await signInWithRedirect(auth, provider);
        return;
      }

      const result = await signInWithPopup(auth, provider);
      await finalizeClientSignIn(result.user, {
        turnstileToken: turnstileToken || undefined,
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      window.sessionStorage.removeItem(redirectTokenStorageKey);
      if (getErrorMessage(err).toLowerCase().includes("captcha")) {
        resetTurnstileChallenge();
      }
      setError(await resolveLoginError(err));
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

        {showDeactivatedNotice && !error && (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            {buildDeactivatedMessage()}
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
              autoComplete="email"
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
              autoComplete="current-password"
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

        <div className="mt-4">
          <TurnstileWidget
            onVerify={setTurnstileToken}
            onExpire={() => setTurnstileToken("")}
            resetSignal={turnstileResetSignal}
          />
        </div>

        <div className="mt-5">
          <div className="relative text-center text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            <span className="relative z-10 bg-transparent px-2">
              Or continue with
            </span>
            <div className="absolute left-0 right-0 top-1/2 -z-0 h-px bg-slate-200 dark:bg-slate-800" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="button-secondary mt-4 w-full !rounded-2xl !py-3 text-sm"
          >
            <span className="mr-2 text-base">G</span>
            Continue with Google
          </button>

          <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
            Google sign-in works for existing accounts, and Google signup starts
            from the sign-up page.
          </p>
        </div>

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
