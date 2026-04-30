"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { APP_DISPLAY_VERSION } from "@/lib/appMeta";
import { useOrgData } from "@/lib/useOrgData";
import ThemeToggle from "./ThemeToggle";

type ModernDashboardShellProps = {
  children: React.ReactNode;
  mobileTitle: string;
  onRequestClassicMode: () => void;
};

type NavItem = {
  href: string;
  label: string;
  emoji: string;
  primary?: boolean;
  desktop?: boolean;
  mobile?: boolean;
};

type MeResponse = {
  uid?: string;
  email?: string;
  name?: string;
  orgName?: string;
  plan?: string;
};

type OnboardingNavRequest = {
  target?: string | null;
  open?: boolean;
  mobile?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", emoji: "📊", primary: true, desktop: true, mobile: true },
  { href: "/dashboard/items", label: "Items", emoji: "📦", primary: true, desktop: true, mobile: true },
  { href: "/dashboard/vendors", label: "Vendors", emoji: "🏪" },
  { href: "/dashboard/locations", label: "Locations", emoji: "📍" },
  { href: "/dashboard/restock", label: "Restock", emoji: "🧾", primary: true, desktop: true, mobile: true },
  { href: "/dashboard/reports", label: "Reports", emoji: "📝", primary: true, desktop: true, mobile: true },
  { href: "/dashboard/users", label: "Users", emoji: "👥" },
  { href: "/dashboard/settings", label: "Settings", emoji: "⚙️", primary: true, desktop: true, mobile: false },
  { href: "/dashboard/help", label: "Help", emoji: "❓" },
];

export default function ModernDashboardShell({
  children,
  mobileTitle,
  onRequestClassicMode,
}: ModernDashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { plan } = useOrgData();
  const [showMore, setShowMore] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [userInfo, setUserInfo] = useState<MeResponse | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [messageState, setMessageState] = useState<"idle" | "sending">("idle");

  const desktopItems = useMemo(
    () => NAV_ITEMS.filter((item) => item.desktop),
    []
  );
  const mobileItems = useMemo(
    () => NAV_ITEMS.filter((item) => item.mobile),
    []
  );
  const moreItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.primary),
    []
  );

  const menuTargets = useMemo(() => new Set(["vendors", "locations", "users", "help"]), []);
  const mobileMenuTargets = useMemo(
    () => new Set(["vendors", "locations", "users", "settings", "help"]),
    []
  );

  useEffect(() => {
    let cancelled = false;

    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user || cancelled) {
        setUserInfo(null);
        return;
      }

      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = (await res.json().catch(() => null)) as MeResponse | null;
        if (!cancelled && res.ok && data) {
          setUserInfo(data);
        }
      } catch {
        if (!cancelled) {
          setUserInfo(null);
        }
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  useEffect(() => {
    function handleOnboardingNavigation(event: Event) {
      const detail = (event as CustomEvent<OnboardingNavRequest>).detail;
      const target = detail?.target || null;
      const shouldOpen = Boolean(detail?.open);
      const isMobile = Boolean(detail?.mobile);

      if (!shouldOpen || !target) {
        setShowMore(false);
        return;
      }

      if (isMobile) {
        setShowMore(mobileMenuTargets.has(target));
        return;
      }

      setShowMore(menuTargets.has(target));
    }

    window.addEventListener(
      "restok:onboarding-navigation",
      handleOnboardingNavigation as EventListener
    );

    return () => {
      window.removeEventListener(
        "restok:onboarding-navigation",
        handleOnboardingNavigation as EventListener
      );
    };
  }, [menuTargets, mobileMenuTargets]);

  async function handleLogout() {
    try {
      await auth.signOut();
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout failed", err);
      alert("Failed to log out");
    }
  }

  async function handleSupportSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessageState("sending");

    const form = new FormData(e.currentTarget);
    if (file) form.append("file", file);
    form.append("metadata", JSON.stringify(userInfo || {}));

    const res = await fetch("/api/support", {
      method: "POST",
      body: form,
    });

    setMessageState("idle");

    if (res.ok) {
      alert("Support message sent!");
    } else {
      alert("Failed to send support message");
    }

    setShowSupport(false);
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 px-4 pt-4 md:px-6 md:pt-6">
        <div className="surface-panel mx-auto flex max-w-7xl items-center gap-3 rounded-[30px] px-4 py-3 shadow-sm md:px-5">
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-3"
          >
            <div className="rounded-2xl bg-sky-50 p-2.5 dark:bg-sky-950/50">
              <Image
                src="/logo.svg"
                alt="Restok Logo"
                width={34}
                height={34}
                className="h-8 w-8"
              />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100 md:text-base">
                Restok
              </div>
              <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                {userInfo?.orgName || "Restock workflow hub"}
              </div>
            </div>
          </Link>

          <nav
            data-onboarding-scope="navigation"
            className="mx-auto hidden min-w-0 items-center gap-1 rounded-full border border-white/50 bg-white/55 p-1 dark:border-white/10 dark:bg-slate-900/50 lg:flex"
          >
            {desktopItems.map((item) => (
              <NavPill
                key={item.href}
                item={item}
                active={pathname === item.href}
              />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSupport(true)}
              className="hidden rounded-full border border-white/50 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900 lg:inline-flex"
            >
              Support
            </button>

            <button
              type="button"
              onClick={() => setShowMore((current) => !current)}
              data-onboarding-target="menu"
              className="inline-flex items-center rounded-full border border-white/50 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Menu
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showMore && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMore(false)}
              className="fixed inset-0 z-40 bg-slate-950/28 backdrop-blur-[1px]"
            />
            <motion.aside
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
              className="fixed inset-x-4 top-[5.5rem] z-50 mx-auto w-auto max-w-md overflow-hidden rounded-[30px] border border-white/50 bg-white/92 p-4 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/92 md:right-6 md:left-auto md:top-[6.3rem] md:w-[360px]"
            >
              <div className="flex items-center justify-between pb-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Workspace menu
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {plan ? `${String(plan).toUpperCase()} plan` : APP_DISPLAY_VERSION}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMore(false)}
                  className="rounded-full px-2 py-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  aria-label="Close menu"
                >
                  ✕
                </button>
              </div>

              <div
                data-onboarding-scope="navigation"
                className="grid gap-2"
              >
                {moreItems.map((item) => (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => {
                      setShowMore(false);
                      router.push(item.href);
                    }}
                    data-onboarding-target={item.label.toLowerCase()}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                      pathname === item.href
                        ? "bg-sky-600 text-white"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="text-base">{item.emoji}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-2 border-t border-slate-200/70 pt-4 dark:border-slate-800">
                <div className="rounded-2xl bg-slate-50 px-1 py-1 dark:bg-slate-900/70">
                  <ThemeToggle />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowMore(false);
                    setShowSupport(true);
                  }}
                  className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span>Contact support</span>
                  <span>💬</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMore(false);
                    onRequestClassicMode();
                  }}
                  className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span>Switch to classic sidebar</span>
                  <span>↺</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMore(false);
                    void handleLogout();
                  }}
                  className="flex w-full items-center justify-between rounded-2xl bg-rose-500 px-4 py-3 text-left text-sm font-medium text-white hover:bg-rose-600"
                >
                  <span>Log out</span>
                  <span>→</span>
                </button>

                <div className="pt-1 text-center text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  {APP_DISPLAY_VERSION}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="mx-auto min-w-0 max-w-7xl px-4 pb-24 pt-4 md:px-6 md:pb-8 md:pt-6">
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
              Restok
            </div>
            <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
              {mobileTitle}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowMore(true)}
            data-onboarding-target="menu"
            className="rounded-full border border-white/50 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
          >
            More
          </button>
        </div>
        {children}
      </main>

      <nav
        data-onboarding-scope="navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/60 bg-white/88 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/88 lg:hidden"
      >
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-2">
          {mobileItems.map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => router.push(item.href)}
              data-onboarding-target={item.label.toLowerCase()}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-[11px] font-medium transition ${
                pathname === item.href
                  ? "bg-sky-600 text-white shadow-lg shadow-sky-500/20"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <span className="text-base">{item.emoji}</span>
              <span>{item.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowMore(true)}
            data-onboarding-target="menu"
            className="flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <span className="text-base">⋯</span>
            <span>More</span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {showSupport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowSupport(false)}
          >
            <motion.form
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              onSubmit={handleSupportSubmit}
              className="surface-panel w-full max-w-md rounded-[30px] p-6 shadow-2xl"
            >
              <h2 className="mb-4 text-xl font-semibold">Contact Support</h2>

              <div className="mb-3 rounded-2xl bg-slate-100/80 p-3 text-sm dark:bg-slate-800/80">
                {!userInfo ? (
                  <div className="flex items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
                  </div>
                ) : (
                  <>
                    <div><strong>User:</strong> {userInfo.name}</div>
                    <div><strong>Email:</strong> {userInfo.email}</div>
                    <div><strong>Org:</strong> {userInfo.orgName}</div>
                    <div><strong>Plan:</strong> {userInfo.plan}</div>
                  </>
                )}
              </div>

              <input
                name="subject"
                placeholder="Subject"
                required
                className="input mb-3"
              />

              <textarea
                name="message"
                placeholder="Describe your issue…"
                required
                className="input mb-4 h-36"
              />

              <label className="mb-2 block text-sm">Screenshot / file (optional)</label>
              <input
                type="file"
                accept="image/*,.pdf,.txt"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="mb-4"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSupport(false)}
                  className="w-1/2 rounded-2xl border p-3 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={messageState === "sending"}
                  className="w-1/2 rounded-2xl bg-sky-600 p-3 text-white hover:bg-sky-700 disabled:opacity-70"
                >
                  {messageState === "sending" ? "Sending..." : "Send"}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavPill({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      data-onboarding-target={item.label.toLowerCase()}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-slate-950 text-white dark:bg-slate-50 dark:text-slate-950"
          : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      {item.label}
    </Link>
  );
}
