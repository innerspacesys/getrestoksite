"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/sidebar";
import BetaNotice from "@/components/BetaNotice";
import OrgLoader from "./OrgLoader";
import { motion } from "framer-motion";

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
  const [requireInstall, setRequireInstall] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("restok-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved === "dark" || (!saved && prefersDark);

    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  useEffect(() => {
    try {
      const ua = window.navigator.userAgent || "";
      const isiOS = /iPhone|iPad|iPod/i.test(ua);
      const isStandalone =
        Boolean((window.navigator as NavigatorWithStandalone).standalone) ||
        isStandaloneDisplayMode();
      const already = localStorage.getItem("restok_add_to_home_done");

      if (isiOS && !isStandalone && !already) {
        const frame = window.requestAnimationFrame(() => {
          setRequireInstall(true);
        });

        const id = setInterval(() => {
          const nowStandalone =
            Boolean((window.navigator as NavigatorWithStandalone).standalone) ||
            isStandaloneDisplayMode();
          if (nowStandalone) {
            localStorage.setItem("restok_add_to_home_done", "1");
            setRequireInstall(false);
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
    };

    document.title = `${titles[pathname] || "Dashboard"} – Restok`;
  }, [pathname]);

  return (
    <OrgLoader>
      <div className="subtle-shell flex min-h-screen">
        {/* DESKTOP SIDEBAR */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* MOBILE DRAWER */}
        <motion.div
          initial={false}
          animate={{ x: open ? 0 : "-100%" }}
          transition={{ type: "tween" }}
          className="fixed inset-y-0 left-0 z-40 w-72 md:hidden"
        >
          <Sidebar onNavigate={() => setOpen(false)} />
        </motion.div>

        {/* OVERLAY */}
        {open && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        {/* CONTENT */}
        <div className="flex-1 flex flex-col">
          {/* MOBILE TOP BAR */}
          <div className="surface-panel md:hidden mx-3 mt-3 flex items-center gap-3 rounded-3xl px-4 py-3">
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
                Dashboard
              </span>
            </div>
          </div>

          <BetaNotice />
          {requireInstall ? (
            <main className="flex-1 p-4 md:p-6" aria-hidden="true">{children}</main>
          ) : (
            <main className="flex-1 p-4 md:p-6">{children}</main>
          )}
        </div>

        {requireInstall && (
          <div className="fixed inset-0 z-[9999] bg-white/80 dark:bg-slate-950/85 flex items-center justify-center p-6 backdrop-blur-md">
            <div className="surface-panel max-w-xl rounded-[32px] p-8 text-center">
              <h2 className="text-2xl font-semibold mb-4">Add Restok to your Home Screen</h2>
              <p className="mb-4 text-sm text-slate-700 dark:text-slate-300">
                To continue using Restok on iPhone, open Safari&apos;s Share
                menu and choose &quot;Add to Home Screen&quot;. You will need
                to use the home screen app to use Restok on iOS.
              </p>
              <div className="flex items-center justify-center gap-3 mt-4">
                
                 
              </div>
            </div>
          </div>
        )}
      </div>
    </OrgLoader>
  );
}
