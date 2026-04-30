"use client";

import { useEffect, useState } from "react";
import { APP_DISPLAY_VERSION } from "@/lib/appMeta";

type AppVersionResponse = {
  displayVersion?: string;
};

type AppVersionLabelProps = {
  className?: string;
  fallback?: string;
};

export default function AppVersionLabel({
  className,
  fallback = APP_DISPLAY_VERSION,
}: AppVersionLabelProps) {
  const [label, setLabel] = useState(fallback);

  useEffect(() => {
    let cancelled = false;

    async function loadVersion() {
      try {
        const res = await fetch("/api/app-meta", {
          cache: "no-store",
          headers: { "cache-control": "no-store" },
        });

        if (!res.ok) return;

        const data = (await res.json()) as AppVersionResponse;
        if (!cancelled && data.displayVersion) {
          setLabel(data.displayVersion);
        }
      } catch {
        // noop
      }
    }

    void loadVersion();

    return () => {
      cancelled = true;
    };
  }, []);

  return <span className={className}>{label}</span>;
}
