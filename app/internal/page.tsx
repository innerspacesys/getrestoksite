"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

type Plan = "basic" | "pro" | "premium" | "enterprise";
type OrgStatus = "active" | "paused" | "canceled";

type InternalUser = {
  // user doc
  id: string; // uid
  email: string;
  name?: string;
  displayName?: string;
  phone?: string;
  orgId?: string | null;
  role?: string;
  disabled?: boolean;

  // org doc (enriched)
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
        router.replace("/internal/login");
        return;
      }

      // Force refresh so new claims apply immediately
      const token = await user.getIdTokenResult(true);

      if (!token.claims.internalAdmin) {
        router.replace("/dashboard");
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
    await loadUsers(); // refresh without full reload
  }

  // -----------------------------
  // LOAD DATA
  // - We list Firestore users
  // - Then enrich each OWNER with org fields (plan/status/stripe IDs/etc)
  // -----------------------------
  async function loadUsers() {
    setLoadingData(true);

    const snap = await getDocs(collection(db, "users"));
    const raw = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<InternalUser, "id">),
    }));

    const owners: InternalUser[] = [];

    // NOTE: Simple + readable. If you ever get lots of users, we can optimize.
    for (const u of raw) {
      if (!u.orgId) continue;

      const orgRef = doc(db, "organizations", u.orgId);
      const orgSnap = await getDoc(orgRef);
      if (!orgSnap.exists()) continue;

      const org = orgSnap.data() as InternalOrg;

      // Only show REAL org owners to avoid duplicates (members/admins)
      if (org.ownerId !== u.id) continue;

      owners.push({
        id: u.id,
        email: u.email,
        name: u.name || u.displayName || "Unknown",
        phone: u.phone || "",
        orgId: u.orgId,
        role: u.role || "owner",
        disabled: !!u.disabled,

        // org enrichment
        orgName: org.name || "",
        plan: (org.plan as Plan) || "basic",
        status: (org.status as OrgStatus) || "active",
        manualPlanOverride: !!org.manualPlanOverride,
        stripeCustomerId: org.stripeCustomerId ?? null,
        stripeSubscriptionId: org.stripeSubscriptionId ?? null,
        internalNotes: org.internalNotes || "",
      });
    }

    // Sort newest-ish by email for sanity
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

    await updateDoc(doc(db, "users", user.id), {
      orgId: null,
      role: "member",
    });

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
      `DELETE ${user.email}?\n\nThis will delete:\n- Firestore user doc\n- Firebase Auth user\n- Their org (if they own it)\n\nThis cannot be undone.`
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

    // soft update locally (no full reload)
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, internalNotes: notes } : u))
    );
  }

  async function handleLogout() {
    await signOut(auth);
    router.replace("/internal/login");
  }

  // -----------------------------
  // FILTER / SEARCH (nice QoL)
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

  // -----------------------------
  // LOADING UI
  // -----------------------------
  if (!authReady || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-12 w-12 border-4 border-sky-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // -----------------------------
  // MAIN UI
  // -----------------------------
  return (
    <main className="p-10 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Restok Admin Panel</h1>
          <p className="text-sm text-slate-500 mt-1">
            Internal-only. No payments shown. God-mode controls.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg"
          >
            + Create Test Account
          </button>

          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mt-6">
        <input
          className="input w-full"
          placeholder="Search email, name, org name, org id…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="text-xs text-slate-400 mt-2">
          Showing {filtered.length} owner org(s)
        </div>
      </div>

      {/* List */}
      <div className="mt-6 space-y-4">
        {filtered.map((u) => (
          <div key={u.id} className="p-5 border rounded-xl bg-white shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="min-w-0">
                <div className="text-lg font-semibold">
                  {u.name}{" "}
                  {u.disabled ? (
                    <span className="ml-2 text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                      Disabled
                    </span>
                  ) : (
                    <span className="ml-2 text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                      Active
                    </span>
                  )}
                </div>

                <div className="text-sm text-slate-500 break-all">{u.email}</div>

                {!!u.phone && (
                  <div className="text-sm text-slate-500 mt-1">📞 {u.phone}</div>
                )}

                <div className="text-xs mt-3 text-slate-400 space-y-1">
                  <div>UID: {u.id}</div>
                  <div>Org ID: {u.orgId || "None"}</div>
                  <div>Org Name: {u.orgName || "—"}</div>
                  <div>Role: {u.role || "owner"}</div>
                  <div>Status: {u.status || "active"}</div>
                  <div>
                    Stripe Customer:{" "}
                    <span className="font-mono">{u.stripeCustomerId || "—"}</span>
                  </div>
                  <div>
                    Subscription:{" "}
                    <span className="font-mono">
                      {u.stripeSubscriptionId || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="w-full lg:w-[360px]">
                {/* Plan controls */}
                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Plan</div>
                    <div className="text-xs text-slate-500">
                      Override:{" "}
                      <span
                        className={
                          u.manualPlanOverride
                            ? "text-amber-700 font-semibold"
                            : "text-slate-500"
                        }
                      >
                        {u.manualPlanOverride ? "ON" : "OFF"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex gap-2">
                    <select
                      className="border rounded px-2 py-1 w-full"
                      value={u.plan || "basic"}
                      onChange={(e) =>
                        updatePlan(u, e.target.value as Plan)
                      }
                    >
                      <option value="basic">Basic</option>
                      <option value="pro">Pro</option>
                      <option value="premium">Premium</option>
                      <option value="enterprise">Enterprise</option>
                    </select>

                    <button
                      className="border rounded px-2 py-1 text-sm"
                      onClick={() => toggleManualOverride(u, !u.manualPlanOverride)}
                      title="Toggle manual override (Stripe webhooks won't overwrite when ON)"
                    >
                      {u.manualPlanOverride ? "Use Stripe" : "Override"}
                    </button>
                  </div>

                  <div className="mt-3">
                    <div className="text-sm font-semibold">Org status</div>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="px-3 py-1.5 rounded border text-sm"
                        onClick={() => updateStatus(u, "active")}
                      >
                        Active
                      </button>
                      <button
                        className="px-3 py-1.5 rounded border text-sm"
                        onClick={() => updateStatus(u, "paused")}
                      >
                        Paused
                      </button>
                      <button
                        className="px-3 py-1.5 rounded border text-sm"
                        onClick={() => updateStatus(u, "canceled")}
                      >
                        Canceled
                      </button>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="border rounded-lg p-3 mt-3">
                  <div className="text-sm font-semibold">Internal notes</div>
                  <textarea
                    className="mt-2 w-full border rounded p-2 text-sm min-h-[90px]"
                    defaultValue={u.internalNotes || ""}
                    placeholder="Notes only you/dad can see…"
                    onBlur={(e) => saveNotes(u, e.target.value)}
                  />
                  <div className="text-xs text-slate-400 mt-1">
                    Saves on blur.
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {u.orgId && (
                    <button
                      onClick={() => removeFromOrg(u)}
                      className="px-4 py-2 bg-amber-500 text-white rounded"
                    >
                      Remove From Org
                    </button>
                  )}

                  {!u.disabled ? (
                    <button
                      onClick={() => toggleDisable(u, true)}
                      className="px-4 py-2 bg-red-600 text-white rounded"
                    >
                      Disable User
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleDisable(u, false)}
                      className="px-4 py-2 bg-green-600 text-white rounded"
                    >
                      Enable User
                    </button>
                  )}

                  <button
                    onClick={() => deleteUser(u)}
                    className="px-4 py-2 bg-black text-white rounded"
                    title="Hard delete user + org (if owner)"
                  >
                    Delete User
                  </button>
                </div>

                <div className="text-xs text-slate-400 mt-2">
                  ⚠️ Delete is permanent.
                </div>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="p-10 border rounded-xl text-center text-slate-500">
            No matching accounts.
          </div>
        )}
      </div>

      {/* CREATE USER MODAL */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setShowCreate(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={createTester}
            className="bg-white p-6 rounded-xl w-full max-w-md space-y-4"
          >
            <h2 className="text-xl font-semibold">Create Tester</h2>

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

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="w-1/2 border py-2 rounded"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="w-1/2 bg-sky-600 text-white py-2 rounded"
              >
                Create
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Creates a Firebase Auth user + org + Firestore user doc.
            </p>
          </form>
        </div>
      )}
    </main>
  );
}
