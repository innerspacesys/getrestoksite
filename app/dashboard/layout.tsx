"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import OnboardingWalkthrough from "@/components/OnboardingWalkthrough";
import OrgLoader from "./OrgLoader";
import { MotionConfig } from "framer-motion";
import ModernDashboardShell from "@/components/ModernDashboardShell";

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

function isStandaloneDisplayMode() {
  return window.matchMedia("(display-mode: standalone)").matches;
}

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/items": "Items",
  "/dashboard/vendors": "Vendors",
  "/dashboard/locations": "Locations",
  "/dashboard/restock": "Restock",
  "/dashboard/reports": "Reports",
  "/dashboard/settings": "Settings",
  "/dashboard/users": "Team",
  "/dashboard/help": "Help",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [showInstallHint, setShowInstallHint] = useState(false);

  useEffect(() => {
    const saved =
      localStorage.getItem("theme") || localStorage.getItem("restok-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved === "dark" || (!saved && prefersDark);

    if (saved) {
      localStorage.setItem("theme", saved);
      localStorage.removeItem("restok-theme");
    }

    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  useEffect(() => {
    try {
      const ua = window.navigator.userAgent || "";
      const isiOS = /iPhone|iPad|iPod/i.test(ua);
      const isStandalone =
        Boolean((window.navigator as NavigatorWithStandalone).standalone) ||
        isStandaloneDisplayMode();
      const dismissed = localStorage.getItem("restok_install_hint_dismissed");

      if (isiOS && !isStandalone && !dismissed) {
        const frame = window.requestAnimationFrame(() => {
          setShowInstallHint(true);
        });

        const id = setInterval(() => {
          const nowStandalone =
            Boolean((window.navigator as NavigatorWithStandalone).standalone) ||
            isStandaloneDisplayMode();
          if (nowStandalone) {
            localStorage.setItem("restok_install_hint_dismissed", "1");
            setShowInstallHint(false);
            clearInterval(id);
          }
        }, 1000);

        return () => {
          window.cancelAnimationFrame(frame);
          clearInterval(id);
        };
      }
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    document.title = `${PAGE_TITLES[pathname] || "Dashboard"} – Restok`;
  }, [pathname]);

  const mobileTitle = PAGE_TITLES[pathname] || "Dashboard";

  function dismissInstallHint() {
    localStorage.setItem("restok_install_hint_dismissed", "1");
    setShowInstallHint(false);
  }

  return (
    <MotionConfig reducedMotion="user">
      <OrgLoader>
        <div className="dashboard-motion subtle-shell min-h-screen">
          <OnboardingWalkthrough />
          {showInstallHint && (
            <div className="mx-3 mt-3 rounded-3xl border border-sky-200 bg-sky-50/95 px-4 py-4 text-sm text-sky-950 shadow-sm md:hidden dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100">
              <div className="font-semibold">Add Restok to your Home Screen</div>
              <p className="mt-1 text-sky-900/80 dark:text-sky-100/80">
                For the best iPhone experience, open Safari&apos;s Share menu
                and choose &quot;Add to Home Screen&quot;. You can still keep
                using Restok in the browser for now.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={dismissInstallHint}
                  className="rounded-2xl bg-sky-600 px-3 py-2 text-white"
                >
                  Continue in Browser
                </button>
                <button
                  type="button"
                  onClick={dismissInstallHint}
                  className="rounded-2xl border border-sky-300 px-3 py-2 text-sky-900 dark:border-sky-700 dark:text-sky-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          <ModernDashboardShell mobileTitle={mobileTitle}>
            {children}
          </ModernDashboardShell>
        </div>
      </OrgLoader>
    </MotionConfig>
  );
}
