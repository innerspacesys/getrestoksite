"use client";

import Link from "next/link";
import { daysRemaining, needsReorder, stockLabel, type StockItem } from "@/lib/inventory";
import { useInventoryClock } from "@/lib/useInventoryClock";
import ItemActions from "@/components/ItemActions";
import { motion } from "framer-motion";
import type { User } from "firebase/auth";
import { useOrgStore, type OrgItem } from "@/lib/orgStore";
import { useEffect, useState } from "react";
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

type DashboardItem = OrgItem & StockItem & {
  name?: string;
  daysLast?: number;
  createdAt?: TimestampLike | null;
};

export default function DashboardHome() {
  const now = useInventoryClock();

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
  const loading = useOrgStore((s) => s.loading);


  // ------------------------------
  // UTILITIES
  // ------------------------------
  const typedItems = items as DashboardItem[];
  const actionItems = typedItems.filter(item => needsReorder(item, now)).sort((a, b) => (daysRemaining(a, now) ?? Infinity) - (daysRemaining(b, now) ?? Infinity));
  const pendingItems = typedItems.filter(item => item.orderStatus === "ordered");
  const stats = {
    totalItems: items.length,
    runningLow: actionItems.filter(item => (daysRemaining(item, now) ?? 0) > 0).length,
    dueToday: actionItems.filter(item => (daysRemaining(item, now) ?? 1) <= 0).length,
  };
  const graphData = typedItems.filter(item => daysRemaining(item, now) !== null).map(item => ({ name: item.name, daysLeft: Math.max(daysRemaining(item, now)!, 0) }));

  const currentUser = user;

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
        <Stat label="Due / overdue" value={stats.dueToday} tone="red" />
      </div>

      <section className="surface-card mt-8 rounded-[30px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">What needs doing today</h2><Link href="/dashboard/restock" className="button-secondary">All supplies</Link></div>
        {!actionItems.length && <p className="mt-4 text-slate-500">{items.length ? "You're caught up. No supplies need reordering today." : "Add your first supply to start tracking reminders."}</p>}
        <div className="mt-4 space-y-4">{actionItems.slice(0, 8).map(item => <article key={item.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{item.name}</h3><span className="text-sm text-amber-700 dark:text-amber-300">{stockLabel(item, now)}</span></div><ItemActions item={item} /></article>)}</div>
        {actionItems.length > 8 && <Link href="/dashboard/restock" className="mt-4 block text-sky-600">View all {actionItems.length} supplies needing attention</Link>}
        <h3 className="mt-7 text-lg font-semibold">Awaiting delivery ({pendingItems.length})</h3>
        {!pendingItems.length && <p className="mt-2 text-sm text-slate-500">No pending orders.</p>}
        <div className="mt-3 space-y-4">{pendingItems.slice(0, 5).map(item => <article key={item.id} className="rounded-2xl border border-sky-200 p-4 dark:border-sky-900"><h4 className="font-semibold">{item.name}</h4><p className="text-sm text-slate-500">Supply estimate: {stockLabel(item, now).toLowerCase()}</p><ItemActions item={item} /></article>)}</div>
        {pendingItems.length > 5 && <Link href="/dashboard/restock" className="mt-4 block text-sky-600">View all pending orders</Link>}
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

    </motion.main>
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
