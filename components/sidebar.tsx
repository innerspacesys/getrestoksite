"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import { auth, db } from "../lib/firebase";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

type Plan = "basic" | "pro" | "premium" | "enterprise";

type SidebarProps = {
  onNavigate?: () => void;
};

type MeResponse = {
  uid?: string;
  email?: string;
  name?: string;
  orgName?: string;
  plan?: string;
};

export default function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const [plan, setPlan] = useState<Plan>("basic");
  const [loading, setLoading] = useState(true);

  const [showSupport, setShowSupport] = useState(false);
  const [userInfo, setUserInfo] = useState<MeResponse | null>(null);
  const [file, setFile] = useState<File | null>(null);

  // Load user + org + plan + /api/me
  useEffect(() => {
    let unsubUser: (() => void) | null = null;
    let unsubOrg: (() => void) | null = null;

    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      // -------- fetch /api/me safely --------
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        if (res.ok) setUserInfo(data);
        else console.warn("ME API failed:", data);
      } catch (err) {
        console.error("Failed to fetch /api/me", err);
      }

      // -------- firestore listeners --------
      unsubUser = onSnapshot(doc(db, "users", user.uid), (userSnap) => {
        const data = userSnap.data();
        if (!data) {
          setLoading(false);
          return;
        }

        const orgId = data.orgId;
        if (!orgId) {
          setLoading(false);
          return;
        }

        unsubOrg?.();

        unsubOrg = onSnapshot(
          doc(db, "organizations", orgId),
          (orgSnap) => {
            const rawPlan = orgSnap.data()?.plan;

            setPlan(
              rawPlan === "pro" ||
                rawPlan === "premium" ||
                rawPlan === "enterprise"
                ? rawPlan
                : "basic"
            );

            setLoading(false);
          }
        );
      });
    });

    return () => {
      unsubAuth();
      unsubUser?.();
      unsubOrg?.();
    };
  }, []);

  return (
    <>
      {/* ---------- SIDEBAR ---------- */}
      <aside
        className="surface-panel sticky top-0 flex h-screen w-72 shrink-0 flex-col overflow-hidden border-r border-white/40 p-3 md:p-4 dark:border-white/10"
      >
        <div className="mb-4 rounded-3xl border border-white/40 bg-white/55 p-3.5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-sky-50 p-2.5 dark:bg-sky-950/50">
              <Image
                src="/logo.svg"
                alt="Restok Logo"
                width={36}
                height={36}
                className="h-9 w-9"
              />
            </div>

            <div>
              <motion.h1
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                Restok
              </motion.h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Restock workflow hub
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1">
          <nav className="flex flex-col gap-1 text-slate-700 dark:text-slate-200">
            <NavItem href="/dashboard" label="Dashboard" emoji="📊" active={pathname === "/dashboard"} onClick={onNavigate} />
            <NavItem href="/dashboard/items" label="Items" emoji="📦" active={pathname === "/dashboard/items"} onClick={onNavigate} />
            <NavItem href="/dashboard/vendors" label="Vendors" emoji="🏪" active={pathname === "/dashboard/vendors"} onClick={onNavigate} />
            <NavItem href="/dashboard/locations" label="Locations" emoji="📍" active={pathname === "/dashboard/locations"} onClick={onNavigate} />
            <NavItem href="/dashboard/restock" label="Restock" emoji="🧾" active={pathname === "/dashboard/restock"} onClick={onNavigate} />
            <NavItem href="/dashboard/reports" label="Reports" emoji="📝" active={pathname === "/dashboard/reports"} onClick={onNavigate} />
            <NavItem href="/dashboard/users" label="Users" emoji="👥" active={pathname === "/dashboard/users"} onClick={onNavigate} />
            <NavItem href="/dashboard/settings" label="Settings" emoji="⚙️" active={pathname === "/dashboard/settings"} onClick={onNavigate} />
            <NavItem href="/dashboard/help" label="Help" emoji="❓" active={pathname === "/dashboard/help"} onClick={onNavigate} />
          </nav>
        </div>

        {/* ---------- Bottom ---------- */}
        <div className="mt-4 flex flex-col gap-2.5 border-t border-slate-200/70 pt-4 dark:border-slate-700/70">
          {/* PLAN */}
          <div className="rounded-3xl border border-slate-200/80 bg-white/65 p-3.5 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Current plan</span>

              <span className={`
                rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em]
                ${
                  plan === "basic"
                    ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                    : plan === "pro"
                    ? "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300"
                    : plan === "premium"
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                }
              `}>
                {loading ? "..." : plan.toUpperCase()}
              </span>
            </div>

            {!loading && plan !== "enterprise" && (
              <button
                onClick={() =>
                  (window.location.href =
                    "/dashboard/settings#billing")
                }
                className="button-primary mt-2.5 w-full !rounded-2xl !px-3 !py-2 text-xs shadow-none"
              >
                {plan === "basic" ? "Upgrade plan" : "Manage plan"}
              </button>
            )}
          </div>

          <ThemeToggle />

          {/* Support button */}
          <button
            onClick={() => setShowSupport(true)}
            className="button-secondary w-full justify-start !rounded-2xl !px-4 !py-3 text-sm"
          >
            <span>💬</span>
            <span>Support</span>
          </button>

          {/* Logout */}
          <motion.button
            onClick={async () => {
              try {
                await auth.signOut();
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              } catch (err) {
                console.error("Logout failed", err);
                alert("Failed to log out");
              }
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="rounded-2xl bg-rose-500 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-rose-600"
          >
            Log Out
          </motion.button>
        </div>
      </aside>

      {/* ---------- SUPPORT MODAL ---------- */}
      <AnimatePresence>
{showSupport && (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    onClick={() => setShowSupport(false)}
  >
    <motion.form
      onClick={(e) => e.stopPropagation()}
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      transition={{ type: "spring", stiffness: 240, damping: 20 }}
      onSubmit={async (e) => {
        e.preventDefault();

        const form = new FormData(e.currentTarget);
        if (file) form.append("file", file);
        form.append("metadata", JSON.stringify(userInfo || {}));

        const res = await fetch("/api/support", {
          method: "POST",
          body: form,
        });

        if (res.ok) alert("Support message sent!");
        else alert("Failed to send support message");

        setShowSupport(false);
      }}
    className="surface-panel w-full max-w-md rounded-[28px] p-6 shadow-2xl"
    >
      <h2 className="text-xl font-semibold mb-4">Contact Support</h2>

      <div className="mb-3 rounded-2xl bg-slate-100/80 p-3 text-sm dark:bg-slate-800/80">
        {!userInfo ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-4 border-sky-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            <div><strong>User:</strong> {userInfo?.name}</div>
            <div><strong>Email:</strong> {userInfo?.email}</div>
            <div><strong>Org:</strong> {userInfo?.orgName}</div>
            <div><strong>Plan:</strong> {userInfo?.plan}</div>
          </>
        )}
      </div>

      <input name="subject" placeholder="Subject" required className="input mb-3" />

      <textarea
        name="message"
        placeholder="Describe your issue…"
        required
        className="input h-36 mb-4"
      />

      <label className="text-sm mb-2 block">Screenshot / file (optional)</label>
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
          className="w-1/2 border p-3 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Cancel
        </button>

        <button
          type="submit"
          className="w-1/2 bg-sky-600 hover:bg-sky-700 text-white p-3 rounded"
        >
          Send
        </button>
      </div>
    </motion.form>
  </motion.div>
)}
</AnimatePresence>
    </>
  );
}

/* ------------- NAV ITEM ------------- */
function NavItem({
  href,
  emoji,
  label,
  active,
  onClick,
}: {
  href: string;
  emoji: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.div whileHover={{ x: 3 }}>
      <Link
        href={href}
        onClick={onClick}
        data-onboarding-target={label.toLowerCase()}
        className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium ${
          active
            ? "bg-sky-600 text-white shadow-lg shadow-sky-500/20"
            : "text-slate-700 hover:bg-white/70 dark:text-slate-200 dark:hover:bg-slate-800/80"
        }`}
      >
        <span className="text-base">{emoji}</span>
        <span>{label}</span>
      </Link>
    </motion.div>
  );
}
