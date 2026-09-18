"use client";

import { useState } from "react";
import { auth, signOut } from "@/lib/auth/client";

type Props = {
  orgId: string | null;
  role: "owner" | "admin" | "member" | null;
  scheduledDeletionAt: string | null;
};

export default function InactiveOrgScreen({ orgId, role, scheduledDeletionAt }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canManageBilling = role === "owner" || role === "admin";

  const retentionDate = scheduledDeletionAt
    ? new Date(scheduledDeletionAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  async function handleResubscribe() {
    if (!orgId || busy) return;
    setBusy(true);
    setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/stripe/create-portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orgId }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.error || "Could not open billing. Please try again.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <section className="surface-panel w-full max-w-lg rounded-[32px] p-8 text-center md:p-10">
        <div
          aria-hidden="true"
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl dark:bg-amber-950"
        >
          ⏸️
        </div>
        <span className="eyebrow mt-6 block">Subscription inactive</span>
        <h1 className="mt-3 text-2xl font-bold">Please resubscribe to see your data</h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          Your Restok subscription isn&apos;t active right now, so your supplies, vendors, and
          reports are paused. Nothing has been deleted.
        </p>

        <div className="mt-6 rounded-2xl bg-slate-100/70 p-4 text-sm dark:bg-slate-800/50">
          {retentionDate ? (
            <p>
              Your data is safe and will be kept until{" "}
              <span className="font-semibold">{retentionDate}</span>. Resubscribe before then to
              restore everything exactly as you left it.
            </p>
          ) : (
            <p>
              Your data is safe. Resubscribe to restore full access to your workspace.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-col items-center gap-3">
          {canManageBilling ? (
            <button
              onClick={handleResubscribe}
              disabled={busy}
              className="button-primary w-full disabled:opacity-50 sm:w-auto sm:px-8"
            >
              {busy ? "Opening billing…" : "Resubscribe"}
            </button>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ask an owner or admin on your team to reactivate the subscription.
            </p>
          )}
          <button
            onClick={() => void signOut(auth)}
            className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Log out
          </button>
        </div>
      </section>
    </main>
  );
}
