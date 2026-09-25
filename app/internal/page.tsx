"use client";

import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/auth/client";
import { onAuthStateChanged, signOut } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import { PLANS } from "@/lib/plans";
import { needsReorder, stockLabel, type StockItem } from "@/lib/inventory";

type Plan = "basic" | "pro" | "premium" | "enterprise";

type Org = {
  orgId: string;
  orgName: string;
  plan: Plan;
  active: boolean;
  status: string;
  canceledAt: string | null;
  scheduledDeletionAt: string | null;
  createdAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  manualPlanOverride: boolean;
  internalNotes: string;
  beta: boolean;
  ownerId: string | null;
  email: string;
  name: string;
  phone: string;
  disabled: boolean;
  role: string;
  lastSignInAt: string | null;
  itemCount: number;
  vendorCount: number;
  locationCount: number;
  lastActivity: string | null;
};

type DetailItem = {
  id: string;
  name: string;
  daysLast?: number;
  reminderDays?: number;
  createdAt: string | null;
  lastRestockedAt: string | null;
  orderStatus?: string;
  snoozedUntil: string | null;
  vendorId?: string | null;
  locationId?: string | null;
};
type Detail = {
  items: DetailItem[];
  vendors: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  members: { id: string; email: string; name?: string; role?: string; disabled?: boolean }[];
  activity: { id: string; itemName?: string; action: string; at: string; actorName?: string }[];
};
type AuditEvent = {
  id: string;
  orgId: string | null;
  orgName: string | null;
  type: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

async function callInternal(path: string, body: Record<string, unknown> = {}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not authenticated.");
  const res = await fetch(`/api/internal/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function ts(value: string | null): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}
function shortDate(value: string | null): string {
  const t = ts(value);
  return t ? new Date(t).toLocaleDateString() : "—";
}
function relative(value: string | null): string {
  const t = ts(value);
  if (!t) return "never";
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
function toStockItem(item: DetailItem): StockItem {
  return {
    daysLast: item.daysLast,
    reminderDays: item.reminderDays,
    orderStatus: item.orderStatus,
    snoozedUntil: item.snoozedUntil,
    createdAt: item.createdAt ? { toDate: () => new Date(item.createdAt as string) } : null,
    lastRestockedAt: item.lastRestockedAt ? { toDate: () => new Date(item.lastRestockedAt as string) } : null,
  };
}

export default function InternalPanel() {
  const router = useRouter();

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [banner, setBanner] = useState("");

  // Filters
  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | Plan>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "scheduled" | "beta">("all");
  const [sortBy, setSortBy] = useState<"new" | "active" | "name" | "plan">("new");

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [detailOrg, setDetailOrg] = useState<Org | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Org | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showAudit, setShowAudit] = useState(false);
  const [audit, setAudit] = useState<AuditEvent[] | null>(null);

  // -----------------------------
  // AUTH — INTERNAL ADMIN ONLY
  // -----------------------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      try {
        const token = await user.getIdTokenResult();
        if (!token.claims.internalAdmin) {
          window.location.href = "https://www.getrestok.com/dashboard";
          return;
        }
        setAuthReady(true);
      } catch {
        await signOut(auth).catch(() => {});
        router.replace("/login");
      }
    });
    return () => unsub();
  }, [router]);

  async function loadData() {
    setLoadingData(true);
    try {
      const { orgs } = await callInternal("data");
      setOrgs(orgs as Org[]);
      setBanner("");
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Failed to load data.");
    }
    setLoadingData(false);
  }

  useEffect(() => {
    if (authReady) loadData();
  }, [authReady]);

  async function run(promise: Promise<unknown>, reload = true) {
    try {
      await promise;
      if (reload) await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Action failed.");
    }
  }

  // -----------------------------
  // ACTIONS
  // -----------------------------
  function setPlan(o: Org, plan: Plan) {
    if (!confirm(`Set ${o.email} to ${plan.toUpperCase()}? (enables manual override)`)) return;
    void run(callInternal("update-org", { orgId: o.orgId, changes: { plan } }));
  }
  function setStatus(o: Org, status: string) {
    void run(callInternal("update-org", { orgId: o.orgId, changes: { status } }));
  }
  function toggleOverride(o: Org) {
    void run(callInternal("update-org", { orgId: o.orgId, changes: { manualPlanOverride: !o.manualPlanOverride } }));
  }
  function saveNotes(o: Org, notes: string) {
    if (notes === o.internalNotes) return;
    setOrgs((prev) => prev.map((x) => (x.orgId === o.orgId ? { ...x, internalNotes: notes } : x)));
    void run(callInternal("update-org", { orgId: o.orgId, changes: { internalNotes: notes } }), false);
  }
  function rescue(o: Org) {
    if (!confirm(`Reactivate ${o.orgName || o.email} and cancel any scheduled deletion?`)) return;
    void run(callInternal("rescue-org", { orgId: o.orgId }));
  }
  function toggleDisable(o: Org, disable: boolean) {
    if (!o.ownerId) return;
    void run(callInternal("disable-user", { uid: o.ownerId, disabled: disable }));
  }
  function removeFromOrg(o: Org) {
    if (!o.ownerId || !confirm(`Remove ${o.email} from their org?`)) return;
    void run(callInternal("remove-membership", { uid: o.ownerId }));
  }
  async function resendSetup(o: Org) {
    if (!o.ownerId) return;
    try {
      const res = await callInternal("resend-setup", { uid: o.ownerId });
      alert(`Password-setup email sent to ${res.to}.`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to send.");
    }
  }
  function confirmDelete() {
    if (!deleteTarget?.ownerId) return;
    void run(callInternal("delete-user", { uid: deleteTarget.ownerId }));
    setDeleteTarget(null);
    setDeleteConfirm("");
  }
  async function openDetail(o: Org) {
    setDetailOrg(o);
    setDetail(null);
    try {
      const data = await callInternal("org-detail", { orgId: o.orgId });
      setDetail(data as Detail);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to load workspace.");
      setDetailOrg(null);
    }
  }
  async function openAudit() {
    setShowAudit(true);
    if (audit) return;
    try {
      const { events } = await callInternal("audit");
      setAudit(events as AuditEvent[]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to load audit log.");
    }
  }

  async function handleLogout() {
    await signOut(auth);
    router.replace("/login");
  }

  // Create modal
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newName, setNewName] = useState("");
  async function createTester(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await callInternal("create-user", { email: newEmail, password: newPass, name: newName });
      setShowCreate(false);
      setNewEmail("");
      setNewPass("");
      setNewName("");
      await loadData();
      alert("Tester account created.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create user.");
    }
  }

  // -----------------------------
  // DERIVED
  // -----------------------------
  const overview = useMemo(() => {
    const total = orgs.length;
    const active = orgs.filter((o) => o.active).length;
    const scheduled = orgs.filter((o) => o.scheduledDeletionAt).length;
    const weekAgo = Date.now() - 7 * 86400000;
    const newThisWeek = orgs.filter((o) => {
      const t = ts(o.createdAt);
      return t !== null && t >= weekAgo;
    }).length;
    const planCounts: Record<Plan, number> = { basic: 0, pro: 0, premium: 0, enterprise: 0 };
    let mrrCents = 0;
    for (const o of orgs) {
      planCounts[o.plan] = (planCounts[o.plan] ?? 0) + 1;
      if (o.active) {
        const p = PLANS[o.plan];
        if (p && "priceMonthly" in p) mrrCents += p.priceMonthly;
      }
    }
    return { total, active, inactive: total - active, scheduled, newThisWeek, planCounts, mrr: mrrCents / 100 };
  }, [orgs]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = orgs.filter((o) => {
      if (planFilter !== "all" && o.plan !== planFilter) return false;
      if (statusFilter === "active" && !o.active) return false;
      if (statusFilter === "inactive" && o.active) return false;
      if (statusFilter === "scheduled" && !o.scheduledDeletionAt) return false;
      if (statusFilter === "beta" && !o.beta) return false;
      if (query) {
        const hay = `${o.email} ${o.name} ${o.orgName} ${o.orgId}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
    list = list.slice().sort((a, b) => {
      if (sortBy === "name") return (a.orgName || a.email).localeCompare(b.orgName || b.email);
      if (sortBy === "plan") return a.plan.localeCompare(b.plan);
      if (sortBy === "active") return (ts(b.lastActivity) ?? 0) - (ts(a.lastActivity) ?? 0);
      return (ts(b.createdAt) ?? 0) - (ts(a.createdAt) ?? 0);
    });
    return list;
  }, [orgs, q, planFilter, statusFilter, sortBy]);

  if (!authReady || loadingData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
      </div>
    );
  }

  const stat = (label: string, value: string | number, hint?: string) => (
    <div className="surface-card rounded-2xl p-4">
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">{value}</div>
      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{label}</div>
      {hint && <div className="mt-1 text-[11px] text-slate-400">{hint}</div>}
    </div>
  );

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-10">
      <section className="surface-panel rounded-[28px] px-6 py-6 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="eyebrow">Restok staff</span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Admin Panel</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Accounts, plans, org status, and workspace support.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowCreate(true)} className="button-primary !py-2.5 text-sm">
              + Create test account
            </button>
            <button onClick={openAudit} className="button-secondary !py-2.5 text-sm">
              Audit log
            </button>
            <button onClick={handleLogout} className="button-secondary !py-2.5 text-sm">
              Log out
            </button>
          </div>
        </div>
      </section>

      {banner && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          {banner}
        </div>
      )}

      {/* Overview */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {stat("Workspaces", overview.total)}
        {stat("Active", overview.active)}
        {stat("Inactive", overview.inactive, overview.scheduled ? `${overview.scheduled} scheduled to delete` : undefined)}
        {stat("New this week", overview.newThisWeek)}
        {stat("Est. MRR", `$${overview.mrr.toFixed(2)}`, "active paid plans / mo")}
        {stat(
          "Plan mix",
          `${overview.planCounts.pro + overview.planCounts.premium}`,
          `${overview.planCounts.basic}B · ${overview.planCounts.pro}P · ${overview.planCounts.premium}Pr`
        )}
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <input
          className="input lg:flex-1"
          placeholder="Search email, name, org name, org id…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <select className="input !py-2 !w-auto" value={planFilter} onChange={(e) => setPlanFilter(e.target.value as "all" | Plan)}>
            <option value="all">All plans</option>
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
            <option value="premium">Premium</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select className="input !py-2 !w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="all">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="scheduled">Scheduled to delete</option>
            <option value="beta">Beta</option>
          </select>
          <select className="input !py-2 !w-auto" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
            <option value="new">Newest</option>
            <option value="active">Last active</option>
            <option value="name">Name</option>
            <option value="plan">Plan</option>
          </select>
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-400">Showing {filtered.length} of {orgs.length} workspaces</div>

      {/* List */}
      <div className="mt-4 space-y-4">
        {filtered.map((o) => {
          const deletionMs = ts(o.scheduledDeletionAt);
          const deletionDays = deletionMs ? Math.ceil((deletionMs - Date.now()) / 86400000) : null;
          return (
            <div key={o.orgId} className="surface-card rounded-[28px] p-5">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">{o.name}</span>
                    {o.active ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Active</span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">Inactive</span>
                    )}
                    {o.disabled && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">Disabled</span>}
                    {o.beta && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">Beta</span>}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">{o.plan}</span>
                  </div>
                  <div className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">{o.email}</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{o.orgName || "—"}</div>

                  {deletionDays !== null && (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      ⏳ Deletes in {deletionDays} day{deletionDays === 1 ? "" : "s"} ({shortDate(o.scheduledDeletionAt)})
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>{o.itemCount} items</span>
                    <span>{o.vendorCount} vendors</span>
                    <span>{o.locationCount} locations</span>
                    <span>Created {shortDate(o.createdAt)}</span>
                    <span>Last login {relative(o.lastSignInAt)}</span>
                    <span>Last activity {relative(o.lastActivity)}</span>
                  </div>

                  <div className="mt-2 space-y-0.5 text-xs text-slate-400 dark:text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{o.orgId}</span>
                      <button onClick={() => navigator.clipboard?.writeText(o.orgId)} className="text-sky-600 hover:underline dark:text-sky-400">copy</button>
                    </div>
                    {o.stripeCustomerId && (
                      <div>
                        Stripe:{" "}
                        <a
                          href={`https://dashboard.stripe.com/customers/${o.stripeCustomerId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-sky-600 hover:underline dark:text-sky-400"
                        >
                          {o.stripeCustomerId} ↗
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Controls */}
                <div className="w-full lg:w-[380px]">
                  <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Plan</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Override:{" "}
                        <span className={o.manualPlanOverride ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
                          {o.manualPlanOverride ? "ON" : "OFF"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <select className="input !py-2" value={o.plan} onChange={(e) => setPlan(o, e.target.value as Plan)}>
                        <option value="basic">Basic</option>
                        <option value="pro">Pro</option>
                        <option value="premium">Premium</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                      <button className="button-secondary !px-3 !py-2 text-sm" onClick={() => toggleOverride(o)}>
                        {o.manualPlanOverride ? "Use Stripe" : "Override"}
                      </button>
                    </div>

                    <div className="mt-3 text-sm font-semibold">CRM status: {o.status}</div>
                    <div className="mt-2 flex gap-2">
                      <button className="button-secondary !px-3 !py-1.5 text-sm" onClick={() => setStatus(o, "active")}>Active</button>
                      <button className="button-secondary !px-3 !py-1.5 text-sm" onClick={() => setStatus(o, "paused")}>Paused</button>
                      <button className="button-secondary !px-3 !py-1.5 text-sm" onClick={() => setStatus(o, "canceled")}>Canceled</button>
                    </div>

                    {(!o.active || o.scheduledDeletionAt) && (
                      <button onClick={() => rescue(o)} className="button-primary mt-3 w-full !py-2 text-sm">
                        ♻️ Reactivate &amp; cancel deletion
                      </button>
                    )}
                  </div>

                  <div className="mt-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                    <div className="text-sm font-semibold">Internal notes</div>
                    <textarea
                      className="input mt-2 min-h-[80px] text-sm"
                      defaultValue={o.internalNotes}
                      placeholder="Staff-only notes…"
                      onBlur={(e) => saveNotes(o, e.target.value)}
                    />
                    <div className="mt-1 text-xs text-slate-400">Saves on blur.</div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => openDetail(o)} className="button-secondary !px-3 !py-2 text-sm">View workspace</button>
                    <button onClick={() => resendSetup(o)} className="button-secondary !px-3 !py-2 text-sm">Resend setup</button>
                    {o.ownerId && (
                      <button onClick={() => removeFromOrg(o)} className="button-secondary !px-3 !py-2 text-sm">Remove from org</button>
                    )}
                    <button onClick={() => toggleDisable(o, !o.disabled)} className="button-secondary !px-3 !py-2 text-sm">
                      {o.disabled ? "Enable user" : "Disable user"}
                    </button>
                    <button onClick={() => { setDeleteTarget(o); setDeleteConfirm(""); }} className="button-danger !px-3 !py-2 text-sm">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="rounded-[28px] border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No matching workspaces.
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCreate(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={createTester} className="surface-panel w-full max-w-md space-y-4 rounded-[28px] p-6 shadow-2xl">
            <h2 className="text-xl font-semibold">Create tester</h2>
            <input className="input" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} required />
            <input className="input" placeholder="Email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
            <input className="input" placeholder="Password" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required />
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowCreate(false)} className="button-secondary w-1/2">Cancel</button>
              <button type="submit" className="button-primary w-1/2">Create</button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Creates an active basic workspace + owner account.</p>
          </form>
        </div>
      )}

      {/* DELETE MODAL (type-to-confirm) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} className="surface-panel w-full max-w-md space-y-4 rounded-[28px] p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">Delete this account?</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Permanently deletes <strong>{deleteTarget.email}</strong>, their auth account, and their org (with all supplies). This cannot be undone.
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Type the email to confirm:</p>
            <input className="input" placeholder={deleteTarget.email} value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} />
            <div className="flex gap-2 pt-1">
              <button onClick={() => setDeleteTarget(null)} className="button-secondary w-1/2">Cancel</button>
              <button onClick={confirmDelete} disabled={deleteConfirm.trim() !== deleteTarget.email} className="button-danger w-1/2 disabled:opacity-40">
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW WORKSPACE MODAL */}
      {detailOrg && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setDetailOrg(null)}>
          <div onClick={(e) => e.stopPropagation()} className="surface-panel my-8 w-full max-w-2xl space-y-4 rounded-[28px] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{detailOrg.orgName || detailOrg.email}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Read-only workspace snapshot</p>
              </div>
              <button onClick={() => setDetailOrg(null)} className="rounded-full px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
            </div>

            {!detail ? (
              <div className="flex justify-center py-10"><div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" /></div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold">Supplies ({detail.items.length})</h3>
                  {detail.items.length ? (
                    <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
                      {detail.items.map((it) => {
                        const s = toStockItem(it);
                        const due = needsReorder(s);
                        return (
                          <li key={it.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                            <span className="min-w-0">
                              <span className="font-medium">{it.name}</span>
                              <span className="ml-2 text-xs text-slate-400">
                                {detail.vendors.find((v) => v.id === it.vendorId)?.name || "no vendor"}
                                {" · "}
                                {detail.locations.find((l) => l.id === it.locationId)?.name || "no location"}
                              </span>
                            </span>
                            <span className={`shrink-0 text-xs ${due ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"}`}>
                              {it.orderStatus === "ordered" ? "Ordered" : stockLabel(s)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">No supplies.</p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold">Vendors ({detail.vendors.length})</h3>
                    <ul className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {detail.vendors.map((v) => <li key={v.id}>{v.name}</li>)}
                      {!detail.vendors.length && <li className="text-slate-400">None</li>}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Locations ({detail.locations.length})</h3>
                    <ul className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {detail.locations.map((l) => <li key={l.id}>{l.name}</li>)}
                      {!detail.locations.length && <li className="text-slate-400">None</li>}
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">Members ({detail.members.length})</h3>
                  <ul className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {detail.members.map((m) => (
                      <li key={m.id} className="break-all">{m.email} · {m.role}{m.disabled ? " · disabled" : ""}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">Recent activity</h3>
                  {detail.activity.length ? (
                    <ul className="mt-1 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                      {detail.activity.map((a) => (
                        <li key={a.id}>
                          {a.action} · {a.itemName || "item"} · {relative(a.at)}{a.actorName ? ` · ${a.actorName}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">No activity.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AUDIT MODAL */}
      {showAudit && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setShowAudit(false)}>
          <div onClick={(e) => e.stopPropagation()} className="surface-panel my-8 w-full max-w-2xl space-y-3 rounded-[28px] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Audit log</h2>
              <button onClick={() => setShowAudit(false)} className="rounded-full px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
            </div>
            {!audit ? (
              <div className="flex justify-center py-10"><div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" /></div>
            ) : audit.length ? (
              <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
                {audit.map((ev) => (
                  <li key={ev.id} className="py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{ev.type}</span>
                      <time className="text-xs text-slate-400" dateTime={ev.createdAt}>{new Date(ev.createdAt).toLocaleString()}</time>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {ev.orgName || ev.orgId || "—"}
                      {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                        <span className="ml-1 break-all font-mono text-slate-400">{JSON.stringify(ev.metadata)}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No audit events yet.</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
