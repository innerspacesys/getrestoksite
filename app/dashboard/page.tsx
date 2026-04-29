"use client";

import { motion } from "framer-motion";
import type { User } from "firebase/auth";
import Link from "next/link";
import { useOrgStore, type OrgItem } from "@/lib/orgStore";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

type TimestampLike = {
  toDate: () => Date;
};

type DashboardItem = OrgItem & {
  name?: string;
  daysLast?: number;
  createdAt?: TimestampLike | null;
};

export default function DashboardHome() {
  const router = useRouter();

  // ------------------------------
  // ⭐ Pull everything from global store
  // ------------------------------
 
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    return () => unsub();
  }, []);

  const items = useOrgStore((s) => s.items);
  const vendors = useOrgStore((s) => s.vendors);
  const members = useOrgStore((s) => s.members);
  const locations = useOrgStore((s) => s.locations);
  const plan = useOrgStore((s) => s.plan);
  const loading = useOrgStore((s) => s.loading);

  const [attentionItems, setAttentionItems] = useState<DashboardItem[]>([]);
  const [showAttentionModal, setShowAttentionModal] = useState(false);

  // ------------------------------
  // UTILITIES
  // ------------------------------
  function needsAttention(item: DashboardItem) {
    if (!item.createdAt?.toDate) return false;

    const created = item.createdAt.toDate();
    const diffDays = Math.floor(
      (Date.now() - created.getTime()) / 86400000
    );

    return (item.daysLast ?? 0) - diffDays <= 3;
  }

  const stats = useMemo(() => {
    let runningLow = 0;
    let dueToday = 0;

    items.forEach((item) => {
      const dashboardItem = item as DashboardItem;
      if (!dashboardItem.createdAt?.toDate) return;

      const created = dashboardItem.createdAt.toDate();
      const emptyDate = new Date(created);
      emptyDate.setDate(emptyDate.getDate() + (dashboardItem.daysLast ?? 0));

      const diffDays = Math.ceil(
        (emptyDate.getTime() - Date.now()) / 86400000
      );

      if (diffDays <= 3) runningLow++;
      if (diffDays === 0) dueToday++;
    });

    return {
      totalItems: items.length,
      runningLow,
      dueToday,
    };
  }, [items]);

  const graphData = useMemo(() => {
    return items
      .map((item) => {
        const dashboardItem = item as DashboardItem;
        if (!dashboardItem.createdAt?.toDate) return null;

        const created = dashboardItem.createdAt.toDate();
        const diff = Math.floor(
          (Date.now() - created.getTime()) / 86400000
        );

        return {
          name: dashboardItem.name,
          daysLeft: Math.max((dashboardItem.daysLast ?? 0) - diff, 0),
        };
      })
      .filter(Boolean);
  }, [items]);

  // ------------------------------
  // ATTENTION POPUP
  // ------------------------------
  useEffect(() => {
    if (!items.length) return;

    const isProOrHigher =
      plan === "pro" || plan === "premium" || plan === "enterprise";
    if (!isProOrHigher) return;

    if (!user?.uid) return;

    const key = `restok_attention_dismissed_${user.uid}`;
    if (sessionStorage.getItem(key)) return;

    const needs = items
      .map((item) => item as DashboardItem)
      .filter(needsAttention);
    if (!needs.length) return;

    setAttentionItems(needs);
    setShowAttentionModal(true);
  }, [items, plan, user]);

  const currentUser = auth.currentUser;

const displayName =
  currentUser?.displayName ||
  currentUser?.email ||
  "there";

  // ------------------------------
  // LOADING
  // ------------------------------
  if (loading) {
    return (
      <motion.main
        className="flex-1 p-10 flex items-center justify-center"
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-slate-300 border-t-sky-500 animate-spin" />
          <p className="text-sm text-slate-500">
            Loading your dashboard…
          </p>
        </div>
      </motion.main>
    );
  }

  // ------------------------------
  // UI
  // ------------------------------
  return (
    <motion.main
      className="mx-auto flex-1 max-w-6xl p-4 md:p-8"
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
    >
      <section className="surface-panel rounded-[32px] px-6 py-7 md:px-8">
        <span className="eyebrow">Overview</span>
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 md:text-4xl">
              Welcome back, {displayName}!
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
              Keep an eye on the items that need attention and get ahead of
              the next reorder cycle.
            </p>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
            <div className="font-semibold">Snapshot</div>
            <div className="mt-1 text-sky-800/80 dark:text-sky-100/75">
              {stats.runningLow} items may need attention soon.
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <Stat label="Total Items" value={stats.totalItems} tone="default" />
        <Stat label="Running Low" value={stats.runningLow} tone="amber" />
        <Stat label="Due Today" value={stats.dueToday} tone="red" />
      </div>

      <section className="surface-card mt-8 rounded-[30px] p-6 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Quick start
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Start with vendors if you want your supplier list tidy first, or
              add them inline while creating items. Restok works either way.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
            {vendors.length} vendors, {items.length} items, {locations.length}{" "}
            locations, {members.length} users
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <QuickStartCard
            title="1. Add vendors first"
            description="Set up supplier names, emails, and websites now, or skip this and attach vendors from the item form later."
            cta="Open vendors"
            href="/dashboard/vendors"
          />
          <QuickStartCard
            title="2. Track your items"
            description="Add the items you regularly buy, set how many days they usually last, and assign a vendor or location when it helps."
            cta="Open items"
            href="/dashboard/items"
          />
          <QuickStartCard
            title="3. Use restock as your action list"
            description="Restock turns low or due items into a working queue so you can email vendors, visit supplier sites, or mark things reordered."
            cta="Open restock"
            href="/dashboard/restock"
          />
          <QuickStartCard
            title="4. Review reports"
            description={
              plan === "basic"
                ? "Upgrade when you want printable shopping lists and analytics. Basic keeps the core tracking workflow simple."
                : "Print pickup lists for in-store runs and use analytics to spot risky items, vendor concentration, and location coverage."
            }
            cta={plan === "basic" ? "View settings" : "Open reports"}
            href={
              plan === "basic"
                ? "/dashboard/settings#billing"
                : "/dashboard/reports"
            }
          />
        </div>

        {(plan === "pro" || plan === "premium" || plan === "enterprise") && (
          <div className="mt-6 rounded-3xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
            <span className="font-semibold">Pro tip:</span> Pro includes room
            for one more user and up to two locations, so you can split
            restock responsibility or organize by office/closet if that helps.
          </div>
        )}
      </section>

      {/* GRAPH */}
      <div className="surface-card mt-8 rounded-[30px] p-6 md:p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Restock timeline
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              A quick view of how many days are left before tracked items run low.
            </p>
          </div>
        </div>

        <div className="mt-6">
          {graphData.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
              Add items to see your restock timeline.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={graphData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.28)" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    borderRadius: "18px",
                    border: "1px solid rgba(148,163,184,0.18)",
                    background: "rgba(15,23,42,0.92)",
                    color: "#e2e8f0",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="daysLeft"
                  stroke="#0ea5e9"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#0ea5e9" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ATTENTION MODAL */}
      {showAttentionModal && (
        <motion.div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            className="surface-panel w-full max-w-lg rounded-[30px] p-6"
          >
            <h2 className="text-lg font-semibold">
              🔔 Take a look at these items
            </h2>

            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
              {attentionItems.map((i) => (
                <div
                  key={i.id}
                  className="rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-700/80"
                >
                  {i.name}
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  sessionStorage.setItem(
                    `restok_attention_dismissed_${user?.uid}`,
                    "true"
                  );
                  setShowAttentionModal(false);
                }}
                className="button-secondary w-1/2 !rounded-2xl !px-4 !py-2"
              >
                Later
              </button>

              <button
                onClick={() => {
                  sessionStorage.setItem(
                    `restok_attention_dismissed_${user?.uid}`,
                    "true"
                  );
                  const ids = attentionItems.map((item) => item.id).join(",");
                  router.push(`/dashboard/restock?review=${ids}`);
                }}
                className="button-primary w-1/2 !rounded-2xl !px-4 !py-2"
              >
                Review items
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.main>
  );
}

function QuickStartCard({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[26px] border border-slate-200/80 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 dark:border-slate-700 dark:bg-slate-900/55"
    >
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {description}
      </p>
      <div className="mt-4 text-sm font-medium text-sky-600 dark:text-sky-300">
        {cta} →
      </div>
    </Link>
  );
}

// ------------------------------
// STAT CARD
// ------------------------------
function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "amber" | "red";
}) {
  const colorClass =
    tone === "amber"
      ? "text-amber-500"
      : tone === "red"
      ? "text-red-500"
      : "text-sky-500";

  return (
    <div className="surface-card rounded-[28px] p-6">
      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {label}
      </h3>
      <p className={`mt-3 text-4xl font-bold tracking-tight ${colorClass}`}>
        {value}
      </p>
    </div>
  );
}
