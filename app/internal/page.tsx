"use client";

import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/auth/client";
import { db } from "@/lib/data/client";
import { onAuthStateChanged, signOut } from "@/lib/auth/client";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "@/lib/data/client";
import { useRouter } from "next/navigation";

type Plan = "basic" | "pro" | "premium" | "enterprise";
type OrgStatus = "active" | "paused" | "canceled";

type InternalUser = {
  id: string;
  email: string;
  name?: string;
  displayName?: string;
  phone?: string;
  orgId?: string | null;
  role?: string;
  disabled?: boolean;

  plan?: Plan;
  status?: OrgStatus;
  manualPlanOverride?: boolean;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  orgName?: string;
  internalNotes?: string;
};

type InternalOrg = {
  ownerId?: string;
  name?: string;
  plan?: Plan;
  status?: OrgStatus;
  manualPlanOverride?: boolean;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  internalNotes?: string;
};

export default function InternalPanel() {
  const router = useRouter();

  const [users, setUsers] = useState<InternalUser[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // -----------------------------
  // AUTH CHECK — INTERNAL ADMIN ONLY (CUSTOM CLAIM)
  // -----------------------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      // Force refresh so new claims apply immediately.
      const token = await user.getIdTokenResult(true);

      if (!token.claims.internalAdmin) {
        // Not an admin — send them to the main app rather than the panel.
        window.location.href = "https://www.getrestok.com/dashboard";
        return;
      }

      setAuthReady(true);
    });

    return () => unsub();
  }, [router]);

  // -----------------------------
  // CREATE TEST USER MODAL
  // -----------------------------
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newName, setNewName] = useState("");

  async function createTester(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const token = await auth.currentUser?.getIdToken();
    if (!token) return alert("Not authenticated.");

    const res = await fetch("/api/internal/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newEmail,
        password: newPass,
        name: newName,
        token,
      }),
    });

    const data = await res.json();
    if (!res.ok) return alert(data.error || "Failed to create user");

    alert("Tester account created!");
    setShowCreate(false);
    setNewEmail("");
    setNewPass("");
    setNewName("");
    await loadUsers();
  }

  // -----------------------------
  // LOAD DATA
  // -----------------------------
  async function loadUsers() {
    setLoadingData(true);

    const snap = await getDocs(collection(db, "users"));
    const raw = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<InternalUser, "id">),
    }));

    const owners: InternalUser[] = [];

    for (const u of raw) {
      if (!u.orgId) continue;

      const orgRef = doc(db, "organizations", u.orgId);
      const orgSnap = await getDoc(orgRef);
      if (!orgSnap.exists()) continue;

      const org = orgSnap.data() as InternalOrg;

      // Only show REAL org owners to avoid duplicates (members/admins).
      if (org.ownerId !== u.id) continue;

      owners.push({
        id: u.id,
        email: u.email,
        name: u.name || u.displayName || "Unknown",
        phone: u.phone || "",
        orgId: u.orgId,
        role: u.role || "owner",
        disabled: !!u.disabled,

        orgName: org.name || "",
        plan: (org.plan as Plan) || "basic",
        status: (org.status as OrgStatus) || "active",
        manualPlanOverride: !!org.manualPlanOverride,
        stripeCustomerId: org.stripeCustomerId ?? null,
        stripeSubscriptionId: org.stripeSubscriptionId ?? null,
        internalNotes: org.internalNotes || "",
      });
    }

    owners.sort((a, b) => a.email.localeCompare(b.email));

    setUsers(owners);
    setLoadingData(false);
  }

  useEffect(() => {
    if (!authReady) return;
    loadUsers();
  }, [authReady]);

  // -----------------------------
  // ACTIONS
  // -----------------------------
  async function removeFromOrg(user: InternalUser) {
    if (!confirm(`Remove ${user.email} from their org?`)) return;

    const token = await auth.currentUser?.getIdToken();
    if (!token) return alert("Not authenticated.");
    const response = await fetch("/api/internal/remove-membership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, uid: user.id }),
    });
    if (!response.ok) return alert("Unable to remove membership.");

    alert("User removed from org");
    await loadUsers();
  }

  async function toggleDisable(user: InternalUser, disable: boolean) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return alert("Not authenticated.");

    const res = await fetch("/api/internal/disable-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, uid: user.id, disabled: disable }),
    });

    const data = await res.json();
    if (!res.ok) return alert(data.error || "Failed");

    alert(disable ? "User disabled" : "User enabled");
    await loadUsers();
  }

  async function deleteUser(user: InternalUser) {
    const ok = confirm(
      `DELETE ${user.email}?\n\nThis will delete:\n- database user doc\n- Supabase Auth user\n- Their org (if they own it)\n\nThis cannot be undone.`
    );
    if (!ok) return;

    const token = await auth.currentUser?.getIdToken();
    if (!token) return alert("Not authenticated.");

    const res = await fetch("/api/internal/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, uid: user.id }),
    });

    const data = await res.json();
    if (!res.ok) return alert(data.error || "Failed to delete user");

    alert("User deleted");
    await loadUsers();
  }

  async function updatePlan(user: InternalUser, newPlan: Plan) {
    if (!user.orgId) return alert("No orgId on this user.");

    const ok = confirm(
      `Set ${user.email} to ${newPlan.toUpperCase()}?\n\nThis enables manual override so Stripe webhooks won't overwrite the plan.`
    );
    if (!ok) return;

    await updateDoc(doc(db, "organizations", user.orgId), {
      plan: newPlan,
      manualPlanOverride: true,
      status: "active",
    });

    alert("Plan updated (manual override enabled).");
    await loadUsers();
  }

  async function updateStatus(user: InternalUser, status: OrgStatus) {
    if (!user.orgId) return alert("No orgId on this user.");

    const ok = confirm(`Set org status to "${status}" for ${user.email}?`);
    if (!ok) return;

    await updateDoc(doc(db, "organizations", user.orgId), { status });
    await loadUsers();
  }

  async function toggleManualOverride(user: InternalUser, enabled: boolean) {
    if (!user.orgId) return alert("No orgId on this user.");

    await updateDoc(doc(db, "organizations", user.orgId), {
      manualPlanOverride: enabled,
    });

    await loadUsers();
  }

  async function saveNotes(user: InternalUser, notes: string) {
    if (!user.orgId) return;

    await updateDoc(doc(db, "organizations", user.orgId), {
      internalNotes: notes,
    });

    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, internalNotes: notes } : u))
    );
  }

  async function handleLogout() {
    await signOut(auth);
    router.replace("/login");
  }

  // -----------------------------
  // FILTER / SEARCH
  // -----------------------------
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return users;

    return users.filter((u) => {
      return (
        u.email.toLowerCase().includes(query) ||
        (u.name || "").toLowerCase().includes(query) ||
        (u.orgName || "").toLowerCase().includes(query) ||
        (u.orgId || "").toLowerCase().includes(query)
      );
    });
  }, [q, users]);

  if (!authReady || loadingData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-10">
      <section className="surface-panel rounded-[28px] px-6 py-6 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="eyebrow">Restok staff</span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Admin Panel
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Internal-only. God-mode controls over accounts, plans, and org status.
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowCreate(true)} className="button-primary !py-2.5 text-sm">
              + Create Test Account
            </button>
            <button onClick={handleLogout} className="button-secondary !py-2.5 text-sm">
              Log out
            </button>
          </div>
        </div>
      </section>

      {/* Search */}
      <div className="mt-6">
        <input
          className="input"
          placeholder="Search email, name, org name, org id…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="mt-2 text-xs text-slate-400">
          Showing {filtered.length} owner org(s)
        </div>
      </div>

      {/* List */}
      <div className="mt-6 space-y-4">
        {filtered.map((u) => (
          <div key={u.id} className="surface-card rounded-[28px] p-5">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {u.name}{" "}
                  {u.disabled ? (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-1 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
                      Disabled
                    </span>
                  ) : (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      Active
                    </span>
                  )}
                </div>

                <div className="break-all text-sm text-slate-500 dark:text-slate-400">{u.email}</div>

                {!!u.phone && (
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">📞 {u.phone}</div>
                )}

                <div className="mt-3 space-y-1 text-xs text-slate-400 dark:text-slate-500">
                  <div>UID: {u.id}</div>
                  <div>Org ID: {u.orgId || "None"}</div>
                  <div>Org Name: {u.orgName || "—"}</div>
                  <div>Role: {u.role || "owner"}</div>
                  <div>Status: {u.status || "active"}</div>
                  <div>
                    Stripe Customer: <span className="font-mono">{u.stripeCustomerId || "—"}</span>
                  </div>
                  <div>
                    Subscription: <span className="font-mono">{u.stripeSubscriptionId || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="w-full lg:w-[360px]">
                {/* Plan controls */}
                <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Plan</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Override:{" "}
                      <span className={u.manualPlanOverride ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
                        {u.manualPlanOverride ? "ON" : "OFF"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex gap-2">
                    <select
                      className="input !py-2"
                      value={u.plan || "basic"}
                      onChange={(e) => updatePlan(u, e.target.value as Plan)}
                    >
                      <option value="basic">Basic</option>
                      <option value="pro">Pro</option>
                      <option value="premium">Premium</option>
                      <option value="enterprise">Enterprise</option>
                    </select>

                    <button
                      className="button-secondary !px-3 !py-2 text-sm"
                      onClick={() => toggleManualOverride(u, !u.manualPlanOverride)}
                      title="Toggle manual override (Stripe webhooks won't overwrite when ON)"
                    >
                      {u.manualPlanOverride ? "Use Stripe" : "Override"}
                    </button>
                  </div>

                  <div className="mt-3">
                    <div className="text-sm font-semibold">Org status</div>
                    <div className="mt-2 flex gap-2">
                      <button className="button-secondary !px-3 !py-1.5 text-sm" onClick={() => updateStatus(u, "active")}>
                        Active
                      </button>
                      <button className="button-secondary !px-3 !py-1.5 text-sm" onClick={() => updateStatus(u, "paused")}>
                        Paused
                      </button>
                      <button className="button-secondary !px-3 !py-1.5 text-sm" onClick={() => updateStatus(u, "canceled")}>
                        Canceled
                      </button>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="text-sm font-semibold">Internal notes</div>
                  <textarea
                    className="input mt-2 min-h-[90px] text-sm"
                    defaultValue={u.internalNotes || ""}
                    placeholder="Staff-only notes…"
                    onBlur={(e) => saveNotes(u, e.target.value)}
                  />
                  <div className="mt-1 text-xs text-slate-400">Saves on blur.</div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {u.orgId && (
                    <button onClick={() => removeFromOrg(u)} className="button-secondary !px-3 !py-2 text-sm">
                      Remove from org
                    </button>
                  )}

                  {!u.disabled ? (
                    <button onClick={() => toggleDisable(u, true)} className="button-secondary !px-3 !py-2 text-sm">
                      Disable user
                    </button>
                  ) : (
                    <button onClick={() => toggleDisable(u, false)} className="button-secondary !px-3 !py-2 text-sm">
                      Enable user
                    </button>
                  )}

                  <button
                    onClick={() => deleteUser(u)}
                    className="button-danger !px-3 !py-2 text-sm"
                    title="Hard delete user + org (if owner)"
                  >
                    Delete user
                  </button>
                </div>

                <div className="mt-2 text-xs text-slate-400">⚠️ Delete is permanent.</div>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="rounded-[28px] border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No matching accounts.
          </div>
        )}
      </div>

      {/* CREATE USER MODAL */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowCreate(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={createTester}
            className="surface-panel w-full max-w-md space-y-4 rounded-[28px] p-6 shadow-2xl"
          >
            <h2 className="text-xl font-semibold">Create tester</h2>

            <input
              className="input"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />

            <input
              className="input"
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              type="email"
            />

            <input
              className="input"
              placeholder="Password"
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              required
            />

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowCreate(false)} className="button-secondary w-1/2">
                Cancel
              </button>
              <button type="submit" className="button-primary w-1/2">
                Create
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Creates a Supabase Auth user + org + database user doc.
            </p>
          </form>
        </div>
      )}
    </main>
  );
}
