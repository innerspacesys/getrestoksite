"use client";

import { useEffect, useState } from "react";

type UpdateNotifierProps = {
  initialVersion: string;
  initialSignature: string;
};

type AppMetaResponse = {
  version?: string;
  displayVersion?: string;
  deploymentSignature?: string;
};

export default function UpdateNotifier({
  initialVersion,
  initialSignature,
}: UpdateNotifierProps) {
  const [nextVersion, setNextVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkForUpdate() {
      try {
        const res = await fetch("/api/app-meta", {
          cache: "no-store",
          headers: { "cache-control": "no-store" },
        });

        if (!res.ok) return;

        const data = (await res.json()) as AppMetaResponse;
        const nextSignature = data.deploymentSignature;

        if (
          !cancelled &&
          nextSignature &&
          nextSignature !== initialSignature
        ) {
          setNextVersion(data.displayVersion || data.version || initialVersion);
          setDismissed(false);
        }
      } catch {
        // noop
      }
    }

    void checkForUpdate();

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void checkForUpdate();
      }
    }

    window.addEventListener("focus", checkForUpdate);
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = window.setInterval(checkForUpdate, 30000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", checkForUpdate);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [initialSignature, initialVersion]);

  if (!nextVersion || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[90] max-w-sm">
      <div className="surface-panel rounded-[28px] p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Update available
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              A newer version of Restok is live. Refresh to load{" "}
              <strong>{nextVersion}</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-full px-2 py-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Dismiss update notice"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="button-primary !rounded-2xl !px-4 !py-2 text-sm"
          >
            Refresh now
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="button-secondary !rounded-2xl !px-4 !py-2 text-sm"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
