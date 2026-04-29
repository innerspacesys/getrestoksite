"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useOrgData } from "@/lib/useOrgData";

type TimestampLike = {
  toDate: () => Date;
};

type Item = {
  id: string;
  name: string;
  daysLast: number;
  createdAt?: TimestampLike | null;
  vendorId?: string | null;
  locationId?: string | null;
};

type Vendor = {
  id: string;
  name: string;
  hasPhysicalStore?: boolean;
};

type Location = {
  id: string;
  name: string;
};

type VendorGroups = Record<string, Item[]>;

function getDaysLeft(item: Item, renderedAt: number) {
  if (!item.createdAt?.toDate) return 999;
  const created = item.createdAt.toDate();
  const diff = Math.floor((renderedAt - created.getTime()) / 86400000);
  return item.daysLast - diff;
}

function LockedBlur({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden no-print"
    >
      <div className="pointer-events-none select-none blur-sm transition group-hover:blur-md">
        {children}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 text-center backdrop-blur-sm dark:bg-slate-900/70">
        <span className="text-xl font-bold">🔒 Pro Feature</span>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Upgrade to unlock advanced reporting & analytics
        </p>
        <button className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-white hover:bg-amber-600">
          See Plans
        </button>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const {
    items,
    vendors: vendorList,
    locations: locationList,
    plan,
    loading,
  } = useOrgData();

  const [filter, setFilter] = useState<"low" | "due" | "all">("low");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showUpsell, setShowUpsell] = useState(false);
  const [renderedAt] = useState(() => Date.now());

  const vendors = useMemo(() => {
    const next: Record<string, Vendor> = {};
    vendorList.forEach((vendor) => {
      next[vendor.id] = vendor as Vendor;
    });
    return next;
  }, [vendorList]);

  const locations = useMemo(() => {
    const next: Record<string, Location> = {};
    locationList.forEach((location) => {
      next[location.id] = location as Location;
    });
    return next;
  }, [locationList]);

  const typedItems = useMemo(() => items.map((item) => item as Item), [items]);

  const filteredItems = useMemo(() => {
    if (filter === "low") {
      return typedItems.filter((item) => {
        const remaining = getDaysLeft(item, renderedAt);
        return remaining <= 3 && remaining > 0;
      });
    }

    if (filter === "due") {
      return typedItems.filter((item) => getDaysLeft(item, renderedAt) <= 0);
    }

    return typedItems;
  }, [filter, typedItems, renderedAt]);

  const storeItems = filteredItems.filter((item) => {
    if (!item.vendorId) return false;
    return vendors[item.vendorId]?.hasPhysicalStore === true;
  });

  const grouped = storeItems.reduce<VendorGroups>((acc, item) => {
    const vendorName =
      (item.vendorId && vendors[item.vendorId]?.name) || "Unknown Vendor";

    if (!acc[vendorName]) acc[vendorName] = [];
    acc[vendorName].push(item);
    return acc;
  }, {});

  const allVisibleIds = filteredItems.map((item) => item.id);
  const allVisibleSelected =
    allVisibleIds.length > 0 &&
    allVisibleIds.every((id) => selectedIds.has(id));

  function toggleAllVisible() {
    const next = new Set(selectedIds);
    if (allVisibleSelected) {
      allVisibleIds.forEach((id) => next.delete(id));
    } else {
      allVisibleIds.forEach((id) => next.add(id));
    }
    setSelectedIds(next);
  }

  function toggleSingle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  const analytics = useMemo(() => {
    const totalTracked = typedItems.length;
    const dueNow = typedItems.filter(
      (item) => getDaysLeft(item, renderedAt) <= 0
    ).length;
    const runningLow = typedItems.filter((item) => {
      const remaining = getDaysLeft(item, renderedAt);
      return remaining > 0 && remaining <= 3;
    }).length;

    const averageCadence = totalTracked
      ? Math.round(
          typedItems.reduce((sum, item) => sum + (item.daysLast || 0), 0) /
            totalTracked
        )
      : 0;

    const averageDaysLeftSource = typedItems.filter(
      (item) => getDaysLeft(item, renderedAt) !== 999
    );
    const averageDaysLeft = averageDaysLeftSource.length
      ? Math.round(
          averageDaysLeftSource.reduce(
            (sum, item) => sum + getDaysLeft(item, renderedAt),
            0
          ) / averageDaysLeftSource.length
        )
      : 0;

    const pickupCandidates = typedItems.filter((item) => {
      if (!item.vendorId) return false;
      return vendors[item.vendorId]?.hasPhysicalStore === true;
    }).length;

    const vendorBreakdown = Object.entries(
      typedItems.reduce<Record<string, number>>((acc, item) => {
        const vendorName =
          (item.vendorId && vendors[item.vendorId]?.name) || "Unassigned";
        acc[vendorName] = (acc[vendorName] || 0) + 1;
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const locationBreakdown = Object.entries(
      typedItems.reduce<Record<string, number>>((acc, item) => {
        const locationName =
          (item.locationId && locations[item.locationId]?.name) || "Unassigned";
        acc[locationName] = (acc[locationName] || 0) + 1;
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    const highestRisk = [...typedItems]
      .sort(
        (a, b) =>
          getDaysLeft(a, renderedAt) - getDaysLeft(b, renderedAt)
      )
      .slice(0, 5);

    return {
      totalTracked,
      dueNow,
      runningLow,
      averageCadence,
      averageDaysLeft,
      pickupCandidates,
      vendorBreakdown,
      locationBreakdown,
      highestRisk,
    };
  }, [locations, typedItems, vendors, renderedAt]);

  if (loading) {
    return (
      <motion.main
        className="flex flex-1 items-center justify-center p-4 md:p-10"
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-sky-500" />
          <p className="text-sm text-slate-500">Preparing your reports…</p>
        </div>
      </motion.main>
    );
  }

  return (
    <motion.main
      className="flex-1 p-4 md:p-10"
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
    >
      <section className="surface-panel rounded-[32px] px-6 py-7 md:px-8">
        <span className="eyebrow">Reporting</span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 md:text-4xl">
          Reports
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
          Print store pickup lists, review problem items, and use analytics to
          spot what needs attention first.
        </p>
      </section>

      <div className="pickup-report surface-card mt-8 max-w-full rounded-[30px] p-6 md:max-w-5xl">
        <div className="no-print">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">🛒 Store Pickup List</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Print a clean list grouped by vendor for in-store shopping.
              </p>
            </div>

            <div className="w-full text-left text-xs text-slate-500 sm:w-auto sm:text-right">
              <div>
                Selected:{" "}
                <span className="font-semibold">
                  {selectedIds.size} item{selectedIds.size !== 1 && "s"}
                </span>
              </div>
              <button
                type="button"
                onClick={toggleAllVisible}
                className="mt-1 inline-flex items-center gap-1 rounded-xl border border-slate-300 px-2 py-1 text-[11px] hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                {allVisibleSelected ? "Unselect all" : "Select all visible"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <FilterButton
              active={filter === "low"}
              activeClassName="bg-amber-500 text-white"
              onClick={() => setFilter("low")}
            >
              Running Low (≤3 days)
            </FilterButton>
            <FilterButton
              active={filter === "due"}
              activeClassName="bg-red-500 text-white"
              onClick={() => setFilter("due")}
            >
              Due / Out
            </FilterButton>
            <FilterButton
              active={filter === "all"}
              activeClassName="bg-sky-600 text-white"
              onClick={() => setFilter("all")}
            >
              All Items
            </FilterButton>

            <button
              onClick={() => window.print()}
              className="w-full rounded-2xl bg-slate-900 px-4 py-2 text-white hover:opacity-90 sm:ml-auto sm:w-auto dark:bg-slate-100 dark:text-slate-900"
            >
              🖨️ Print List
            </button>
          </div>
        </div>

        <div className="mb-6 hidden text-center print:block">
          <Image
            src="/logo.svg"
            alt="Restok Logo"
            width={48}
            height={48}
            className="mx-auto mb-2"
          />
          <h1 className="text-2xl font-bold">Restok Store Pickup List</h1>
          <p className="text-sm text-slate-600">
            Generated: {new Date().toLocaleString()}
          </p>
        </div>

        <div className="no-print mt-6 space-y-8">
          {Object.keys(grouped).length === 0 && (
            <p className="text-slate-500 dark:text-slate-400">
              No in-store pickup items match this filter yet.
            </p>
          )}

          {Object.entries(grouped).map(([vendorName, list]) => (
            <div
              key={vendorName}
              className="rounded-xl border bg-slate-50 shadow-sm dark:bg-slate-800/60"
            >
              <div className="flex items-center justify-between rounded-t-xl bg-slate-200 px-4 py-3 dark:bg-slate-700">
                <h3 className="text-lg font-semibold">🏪 {vendorName}</h3>
                <span className="text-sm">
                  {list.length} item{list.length !== 1 && "s"}
                </span>
              </div>

              <div className="p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-700/70">
                      <th className="w-6 px-2 py-2">✓</th>
                      <th className="px-2 py-2 text-left">Item</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-sky-600"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSingle(item.id)}
                          />
                        </td>
                        <td className="px-2 py-2">{item.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 hidden print:block">
          {Object.entries(grouped).map(([vendorName, list]) => {
            const selected = list.filter((item) => selectedIds.has(item.id));
            if (!selected.length) return null;

            return (
              <div key={vendorName} className="mb-8 rounded-lg border p-4">
                <div className="mb-2 flex justify-between">
                  <h2 className="text-lg font-bold">🏪 {vendorName}</h2>
                  <span className="text-sm">
                    {selected.length} item{selected.length !== 1 && "s"}
                  </span>
                </div>
                <table className="w-full border-t text-sm">
                  <thead>
                    <tr>
                      <th className="w-8 py-2 text-left">☐</th>
                      <th className="py-2 text-left">Item</th>
                      <th className="w-32 py-2 text-left">Cycle (days)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="py-2">☐</td>
                        <td className="py-2">{item.name}</td>
                        <td className="py-2">{item.daysLast || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>

      <h2 className="no-print mt-12 text-2xl font-bold">📈 Advanced Analytics</h2>

      {plan === "basic" ? (
        <LockedBlur onClick={() => setShowUpsell(true)}>
          <div className="surface-card mt-4 max-w-full rounded-[30px] p-6 md:max-w-5xl">
            <div className="grid gap-4 md:grid-cols-4">
              {["Tracked items", "Due now", "Avg cadence", "Pickup-ready"].map(
                (label) => (
                  <div key={label} className="rounded-2xl border p-4">
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="mt-4 h-8 w-12 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  </div>
                )
              )}
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="h-56 animate-pulse rounded-3xl border bg-slate-50 dark:bg-slate-800/60" />
              <div className="h-56 animate-pulse rounded-3xl border bg-slate-50 dark:bg-slate-800/60" />
            </div>
          </div>
        </LockedBlur>
      ) : (
        <div className="mt-4 space-y-6 no-print">
          <div className="grid gap-4 md:grid-cols-4">
            <AnalyticsCard label="Tracked items" value={analytics.totalTracked} />
            <AnalyticsCard label="Due now" value={analytics.dueNow} tone="red" />
            <AnalyticsCard
              label="Average cadence"
              value={`${analytics.averageCadence || 0}d`}
              tone="sky"
            />
            <AnalyticsCard
              label="Pickup-ready"
              value={analytics.pickupCandidates}
              tone="emerald"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="surface-card rounded-[30px] p-6">
              <h3 className="text-lg font-semibold">Operational snapshot</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                A quick read on how healthy your tracked inventory looks right now.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <MiniMetric
                  label="Running low"
                  value={analytics.runningLow}
                  helper="Items with 3 days or less remaining"
                />
                <MiniMetric
                  label="Average days left"
                  value={`${analytics.averageDaysLeft}d`}
                  helper="Across items with active tracking dates"
                />
                <MiniMetric
                  label="Store pickup items"
                  value={analytics.pickupCandidates}
                  helper="Items linked to vendors with physical stores"
                />
              </div>
            </div>

            <div className="surface-card rounded-[30px] p-6">
              <h3 className="text-lg font-semibold">Most urgent items</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                What should probably be reviewed first.
              </p>
              <div className="mt-4 space-y-3">
                {analytics.highestRisk.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Add some items to see risk rankings.
                  </p>
                )}
                {analytics.highestRisk.map((item) => {
                  const remaining = getDaysLeft(item, renderedAt);
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50"
                    >
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {item.name}
                      </div>
                      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {remaining <= 0
                          ? "Due or out now"
                          : `${remaining} day${remaining === 1 ? "" : "s"} left`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="surface-card rounded-[30px] p-6">
              <h3 className="text-lg font-semibold">Vendor breakdown</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Where most of your tracked items are sourced from.
              </p>
              <div className="mt-5 space-y-4">
                {analytics.vendorBreakdown.map(([name, count]) => (
                  <BarRow
                    key={name}
                    label={name}
                    value={count}
                    total={Math.max(analytics.totalTracked, 1)}
                  />
                ))}
              </div>
            </div>

            <div className="surface-card rounded-[30px] p-6">
              <h3 className="text-lg font-semibold">Location coverage</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                How your tracked items are spread across departments or locations.
              </p>
              <div className="mt-5 space-y-4">
                {analytics.locationBreakdown.map(([name, count]) => (
                  <BarRow
                    key={name}
                    label={name}
                    value={count}
                    total={Math.max(analytics.totalTracked, 1)}
                    tone="emerald"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          aside,
          nav,
          header,
          .no-print,
          button {
            display: none !important;
          }

          body {
            background: white !important;
          }

          main {
            padding: 0 !important;
          }

          .pickup-report {
            border: none !important;
            box-shadow: none !important;
            max-width: 900px !important;
            margin: 0 auto !important;
          }

          .report-section {
            page-break-inside: avoid;
          }
        }
      `}</style>

      {showUpsell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 no-print">
          <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-xl dark:bg-slate-900">
            <h2 className="text-2xl font-bold">Upgrade to Pro</h2>
            <ul className="mt-4 space-y-2">
              <li>✔️ Restock analytics</li>
              <li>✔️ Problem item tracking</li>
              <li>✔️ Vendor and location insights</li>
              <li>✔️ Better purchasing visibility</li>
            </ul>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => setShowUpsell(false)}
                className="w-full rounded-lg border py-2 sm:w-1/2"
              >
                Maybe later
              </button>
              <button
                onClick={() => {
                  setShowUpsell(false);
                  window.location.href = "/dashboard/settings#billing";
                }}
                className="w-full rounded-lg bg-amber-500 py-2 text-white sm:w-1/2"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.main>
  );
}

function FilterButton({
  children,
  active,
  activeClassName,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  activeClassName: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-3 py-1.5 ${
        active ? activeClassName : "bg-slate-200 dark:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function AnalyticsCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "red" | "sky" | "emerald";
}) {
  const toneClass =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100"
      : tone === "sky"
        ? "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100"
        : tone === "emerald"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100"
          : "border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100";

  return (
    <div className={`rounded-[24px] border p-5 ${toneClass}`}>
      <div className="text-sm font-medium opacity-80">{label}</div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: number | string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
        {value}
      </div>
      <div className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {helper}
      </div>
    </div>
  );
}

function BarRow({
  label,
  value,
  total,
  tone = "sky",
}: {
  label: string;
  value: number;
  total: number;
  tone?: "sky" | "emerald";
}) {
  const width = Math.max(8, Math.round((value / total) * 100));
  const colorClass = tone === "emerald" ? "bg-emerald-500" : "bg-sky-600";

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="font-medium text-slate-900 dark:text-slate-100">
          {label}
        </div>
        <div className="text-slate-500 dark:text-slate-400">{value}</div>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
