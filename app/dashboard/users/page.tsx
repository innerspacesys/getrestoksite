"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { softSpring } from "@/lib/motion";
import { PLANS } from "@/lib/plans";
import { useOrgStore, type OrgMember } from "@/lib/orgStore";

export default function UsersPage() {
  const router = useRouter();

  const { orgId, plan, role, members, loading } = useOrgStore();

  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!auth.currentUser) router.push("/login");
  }, [router]);

  const memberLimit = (() => {
    if (!plan) return Infinity;
    const planConfig = PLANS[plan as keyof typeof PLANS];
    return "limits" in planConfig ? planConfig.limits.users : Infinity;
  })();

  const atLimit = memberLimit !== Infinity && members.length >= memberLimit;

  const adminCount = members.filter(
    (m: OrgMember) => m.role === "admin" || m.role === "owner"
  ).length;

  const isLastAdmin = (m: OrgMember) =>
    (m.role === "admin" || m.role === "owner") && adminCount <= 1;

  async function createUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgId) return;

    const token = await auth.currentUser?.getIdToken();

    const res = await fetch("/api/org/invite-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email, orgId }),
    });

    const data = await res.json();
    if (data.error) return alert(data.error);

    setEmail("");
    setShowAdd(false);
  }

  async function updateRole(uid: string, newRole: string) {
    const token = await auth.currentUser?.getIdToken();

    const res = await fetch("/api/org/update-role", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ uid, role: newRole }),
    });

    const data = await res.json();
    if (data.error) alert(data.error);
  }

  async function transferOwnership(uid: string) {
    if (!confirm("Transfer organization ownership?")) return;

    const token = await auth.currentUser?.getIdToken();

    const res = await fetch("/api/org/transfer-ownership", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ uid }),
    });

    const data = await res.json();
    if (data.error) alert(data.error);
  }

  async function deleteUser(uid: string, m: OrgMember) {
    if (uid === auth.currentUser?.uid) return alert("You cannot remove yourself.");
    if (m.role === "owner") return alert("You cannot remove the owner.");
    if (isLastAdmin(m)) return alert("You must have at least one admin.");

    if (!confirm("Remove this user?")) return;

    const token = await auth.currentUser?.getIdToken();

    const res = await fetch("/api/org/delete-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ uid }),
    });

    const data = await res.json();
    if (data.error) alert(data.error);
  }

  if (loading || !plan || !role) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <motion.main
      className="mx-auto max-w-6xl flex-1 p-4 md:p-10"
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
    >
      <section className="surface-panel rounded-[32px] px-6 py-7 md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="eyebrow">Team Management</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 md:text-4xl">
              Team
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
              Manage who has access to your organization, who can administer billing and setup,
              and how ownership is handled over time.
            </p>
          </div>

          <div className="rounded-3xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100 lg:min-w-[240px]">
            <div className="font-semibold">Access summary</div>
            <div className="mt-1">
              {memberLimit === Infinity
                ? `${members.length} active users`
                : `${members.length} / ${memberLimit} seats used`}
            </div>
            <div className="mt-2 inline-flex rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-800 dark:bg-sky-950/50 dark:text-sky-100">
              {role.toUpperCase()}
            </div>
          </div>
        </div>
      </section>

      {role === "member" && (
        <div className="surface-card mt-6 max-w-xl rounded-[28px] p-6">
          <h2 className="text-xl font-semibold">Managed by your organization</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            User management is handled by your organization administrator.
          </p>
        </div>
      )}

      {plan === "basic" && role !== "member" && (
        <div className="surface-card mt-6 max-w-xl rounded-[28px] p-6">
          <h2 className="text-xl font-semibold">Add more users</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Your current plan only supports one user. Upgrade to unlock team accounts.
          </p>
          <button
            onClick={() => (window.location.href = "/dashboard/settings#billing")}
            className="button-primary mt-4 !py-2 text-sm"
          >
            Upgrade plan
          </button>
        </div>
      )}

      {plan !== "basic" && role !== "member" && (
        <>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">Organization members</h2>

            {(role === "owner" || role === "admin") && (
              <button
                onClick={() => !atLimit && setShowAdd(true)}
                disabled={atLimit}
                className={`rounded-2xl px-4 py-2.5 font-medium text-white ${
                  atLimit ? "bg-gray-400" : "bg-sky-600 hover:bg-sky-700"
                }`}
              >
                + Add User
              </button>
            )}
          </div>

          <div className="mt-6 space-y-4">
            {members.length === 0 && (
              <div className="rounded-[28px] border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No members yet.
              </div>
            )}

            {members.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...softSpring, delay: Math.min(i, 4) * 0.045 }}
                className="surface-card flex flex-col gap-3 rounded-[28px] p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="break-all font-medium text-slate-900 dark:text-slate-100">{m.email}</div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">{m.role}</div>
                </div>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {role === "owner" && m.role !== "owner" && (
                    <button
                      onClick={() => transferOwnership(m.id)}
                      className="button-secondary !px-3 !py-2 text-sm"
                    >
                      Transfer
                    </button>
                  )}

                  {(role === "owner" || role === "admin") && m.role !== "owner" && (
                    <>
                      <button
                        disabled={isLastAdmin(m)}
                        onClick={() =>
                          updateRole(m.id, m.role === "admin" ? "member" : "admin")
                        }
                        className="button-secondary !px-3 !py-2 text-sm disabled:opacity-50"
                      >
                        {m.role === "admin" ? "Demote" : "Promote"}
                      </button>

                      <button
                        disabled={isLastAdmin(m)}
                        onClick={() => deleteUser(m.id, m)}
                        className="button-danger !px-3 !py-2 text-sm disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Invite Modal */}
          {showAdd && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <form
                onSubmit={createUser}
                className="surface-panel w-full max-w-md space-y-4 rounded-[28px] p-6 shadow-2xl"
              >
                <h2 className="text-lg font-semibold">Invite new user</h2>

                <input
                  className="input"
                  placeholder="User email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <p className="text-xs text-slate-500">The user will receive an invite email.</p>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="button-secondary w-1/2"
                  >
                    Cancel
                  </button>

                  <button type="submit" className="button-primary w-1/2">
                    Send invite
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </motion.main>
  );
}
