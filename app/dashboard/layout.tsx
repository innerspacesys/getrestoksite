"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/sidebar";
import OnboardingWalkthrough from "@/components/OnboardingWalkthrough";
import OrgLoader from "./OrgLoader";
import { motion } from "framer-motion";
import ModernDashboardShell from "@/components/ModernDashboardShell";

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

function isStandaloneDisplayMode() {
  return window.matchMedia("(display-mode: standalone)").matches;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [showInstallHint, setShowInstallHint] = useState(false);
  const [storedNavMode, setStoredNavMode] = useState<"classic" | "modern">(() => {
    if (typeof window === "undefined") return "modern";
    const savedMode = window.localStorage.getItem("restok-dashboard-nav");
    return savedMode === "classic" || savedMode === "modern" ? savedMode : "modern";
  });

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
    const titles: Record<string, string> = {
      "/dashboard": "Dashboard",
      "/dashboard/items": "Items",
      "/dashboard/vendors": "Vendors",
      "/dashboard/locations": "Locations",
      "/dashboard/restock": "Restock",
      "/dashboard/reports": "Reports",
      "/dashboard/settings": "Settings",
      "/dashboard/users": "Users",
      "/dashboard/help": "Help",
    };

    document.title = `${titles[pathname] || "Dashboard"} – Restok`;
  }, [pathname]);

  const mobileTitleMap: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/dashboard/items": "Items",
    "/dashboard/vendors": "Vendors",
    "/dashboard/locations": "Locations",
    "/dashboard/restock": "Restock",
    "/dashboard/reports": "Reports",
    "/dashboard/settings": "Settings",
    "/dashboard/users": "Users",
    "/dashboard/help": "Help",
  };
  const mobileTitle = mobileTitleMap[pathname] || "Dashboard";

  const navMode = storedNavMode;

  function dismissInstallHint() {
    localStorage.setItem("restok_install_hint_dismissed", "1");
    setShowInstallHint(false);
  }

  function switchNavMode(mode: "classic" | "modern") {
    localStorage.setItem("restok-dashboard-nav", mode);
    setStoredNavMode(mode);
    setOpen(false);
  }

  return (
    <OrgLoader>
      {navMode === "modern" ? (
        <div className="subtle-shell min-h-screen">
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
          <ModernDashboardShell
            mobileTitle={mobileTitle}
            onRequestClassicMode={() => switchNavMode("classic")}
          >
            {children}
          </ModernDashboardShell>
        </div>
      ) : (
      <div className="subtle-shell min-h-screen md:grid md:grid-cols-[clamp(16rem,22vw,18.5rem)_minmax(0,1fr)]">
        {/* DESKTOP SIDEBAR */}
        <div className="hidden md:block md:min-w-0">
          <Sidebar onSwitchNavMode={() => switchNavMode("modern")} />
        </div>

        {/* MOBILE DRAWER */}
        <motion.div
          initial={false}
          animate={{ x: open ? 0 : "-100%" }}
          transition={{ type: "tween" }}
          className="fixed inset-y-0 left-0 z-40 w-72 md:hidden"
        >
          <Sidebar
            onNavigate={() => setOpen(false)}
            onSwitchNavMode={() => switchNavMode("modern")}
          />
        </motion.div>

        {/* OVERLAY */}
        {open && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        {/* CONTENT */}
        <div className="flex min-w-0 flex-1 flex-col">
          <OnboardingWalkthrough />
          {/* MOBILE TOP BAR */}
          <div className="surface-panel mx-3 mt-3 flex items-center gap-3 rounded-3xl px-4 py-3 md:hidden">
            <button
              onClick={() => setOpen(true)}
              className="rounded-2xl bg-slate-100 px-3 py-2 text-xl dark:bg-slate-800"
              aria-label="Open menu"
            >
              ☰
            </button>
            <div>
              <span className="block font-semibold">Restok</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {mobileTitle}
              </span>
            </div>
          </div>
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

          <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
      )}
    </OrgLoader>
  );
}
