"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import {
  EmailAuthProvider,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { deleteDoc, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { PLANS } from "@/lib/plans";

type PlanKey = keyof typeof PLANS;

const PLAN_SUMMARIES: Record<
  PlanKey,
  { name: string; description: string; highlights: string[] }
> = {
  basic: {
    name: "Basic",
    description: "Simple tracking for a smaller operation.",
    highlights: [
      "Track up to 5 items",
      "1 user included",
      "1 location available",
      "Shopping-list style reports stay available",
    ],
  },
  pro: {
    name: "Pro",
    description: "Better collaboration and smarter planning.",
    highlights: [
      "Track up to 10 items",
      "Invite 1 more teammate",
      "Use up to 2 locations",
      "Unlock advanced reports and analytics",
    ],
  },
  premium: {
    name: "Premium",
    description: "Full visibility for larger teams and workflows.",
    highlights: [
      "Unlimited items",
      "Unlimited users",
      "Unlimited locations",
      "Advanced reporting and priority support",
    ],
  },
  enterprise: {
    name: "Enterprise",
    description: "Custom support and scale for bigger operations.",
    highlights: [
      "Custom implementation support",
      "Flexible limits",
      "Priority onboarding",
      "Advanced planning workflows",
    ],
  },
};

export default function SettingsPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [name, setName] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [lowStockAlerts, setLowStockAlerts] = useState(true);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [prefsMsg, setPrefsMsg] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [plan, setPlan] = useState<PlanKey>("basic");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("Your organization");
  const [role, setRole] = useState<"owner" | "admin" | "member">("member");
  const [planLoaded, setPlanLoaded] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      if (!nextUser) {
        router.push("/login");
        return;
      }
      setUser(nextUser);
      setLoadingUser(false);
    });

    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      const data = (snap.data() || {}) as {
        name?: string;
        emailNotifications?: boolean;
        lowStockAlerts?: boolean;
        orgId?: string;
        role?: "owner" | "admin" | "member";
      };

      setName(data.name || user.displayName || "");
      setEmailNotifications(data.emailNotifications ?? true);
      setLowStockAlerts(data.lowStockAlerts ?? true);

      if (data.orgId) {
        setOrgId(data.orgId);
      }

      setRole(
        data.role === "owner" || data.role === "admin" ? data.role : "member"
      );
    });

    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!orgId) return;

    const unsubOrg = onSnapshot(doc(db, "organizations", orgId), (orgSnap) => {
      const rawPlan = orgSnap.data()?.plan;
      setPlan(
        rawPlan === "pro" ||
          rawPlan === "premium" ||
          rawPlan === "enterprise"
          ? rawPlan
          : "basic"
      );
      setOrgName(orgSnap.data()?.name || "Your organization");
      setPlanLoaded(true);
    });

    return () => unsubOrg();
  }, [orgId]);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const el = document.querySelector(hash);
    if (!el) return;

    setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
  }, []);

  const planSummary = PLAN_SUMMARIES[plan];
  const canManageBilling = role === "owner" || role === "admin";

  const quickStartSteps = useMemo(() => {
    const steps = [
      {
        title: "Set up vendors first or add them inline",
        body:
          "You can organize suppliers on the Vendors page, or just create them from the Add Item modal when you need to move faster.",
      },
      {
        title: "Add the items you actually reorder",
        body:
          "Track the supplies that matter most first. Give each item a realistic refill cadence so alerts are useful from day one.",
      },
      {
        title: "Use Restock to review what needs action",
        body:
          "The Restock page is where your team acts on low or due items. It turns your tracking into an actual daily workflow.",
      },
    ];

    if (plan === "basic") {
      steps.splice(2, 0, {
        title: "Use your first location if it helps",
        body:
          "Basic includes one location. It is optional, but it can still help if you want to separate front-of-house from storage.",
      });
    }

    if (plan === "pro") {
      steps.splice(2, 0, {
        title: "Add another teammate and set up 2 locations",
        body:
          "Pro gives you one more user seat and up to 2 locations, so you can split work across people and spaces instead of keeping everything in one bucket.",
      });
    }

    if (plan === "premium" || plan === "enterprise") {
      steps.splice(2, 0, {
        title: "Structure the app around your real operation",
        body:
          "Use vendors, locations, and teammates together so reports and restock reviews reflect how your business actually runs.",
      });
    }

    if (plan !== "basic") {
      steps.push({
        title: "Use Reports for shopping lists and analytics",
        body:
          "Reports can print a store shopping list grouped by vendor, and Pro or higher also unlocks analytics to show item risk, vendor concentration, and location coverage.",
      });
    } else {
      steps.push({
        title: "Use Reports for store pickup lists",
        body:
          "Even on Basic, Reports helps you print a simple in-store shopping list for items that need to be picked up.",
      });
    }

    steps.push({
      title: "Tune the app in Settings",
      body:
        "Use Settings to manage your profile, control notifications, review your plan, and handle security or billing tasks.",
    });

    return steps;
  }, [plan]);

  function getErrorMessage(err: unknown, fallback: string) {
    return err instanceof Error ? err.message : fallback;
  }

  async function handleSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    setProfileMsg(null);
    setError(null);

    try {
      const trimmedName = name.trim();
      await updateProfile(user, { displayName: trimmedName });
      await updateDoc(doc(db, "users", user.uid), { name: trimmedName });
      setProfileMsg("Profile saved.");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to save profile."));
    }

    setSavingProfile(false);
  }

  async function handleSavePrefs() {
    if (!user) return;

    setSavingPrefs(true);
    setPrefsMsg(null);
    setError(null);

    try {
      await updateDoc(doc(db, "users", user.uid), {
        emailNotifications,
        lowStockAlerts,
      });
      setPrefsMsg("Notification preferences saved.");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to save preferences."));
    }

    setSavingPrefs(false);
  }

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;

    setError(null);
    setPasswordMsg(null);

    try {
      const cred = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPassword);

      setPasswordMsg("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to update password."));
    }
  }

  async function handleDeleteAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;

    if (deleteConfirmText !== "DELETE") {
      setError('You must type "DELETE" to confirm.');
      return;
    }

    if (role === "owner") {
      setError(
        "Transfer ownership before deleting the organization owner's account."
      );
      return;
    }

    try {
      const cred = EmailAuthProvider.credential(user.email!, deletePassword);
      await reauthenticateWithCredential(user, cred);

      await deleteDoc(doc(db, "users", user.uid));
      await deleteUser(user);
      router.push("/");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to delete account."));
    }
  }

  if (loadingUser || !planLoaded) {
    return (
      <motion.main
        className="flex min-h-screen flex-1 items-center justify-center text-slate-500"
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-slate-300 border-t-sky-500" />
          Loading settings…
        </div>
      </motion.main>
    );
  }

  if (!user) return null;

  return (
    <motion.main
      className="mx-auto flex-1 max-w-6xl p-4 text-slate-800 dark:text-slate-100 md:p-10"
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <section className="surface-panel rounded-[32px] px-6 py-7 md:px-8">
        <span className="eyebrow">Account & Workspace</span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 md:text-4xl">
          Settings
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
          Manage your account, notification behavior, billing access, and the
          best-practice setup for {orgName}.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-white/70 px-3 py-1 text-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
            Signed in as {user.displayName || name || "User"}
          </span>
          <span className="rounded-full bg-white/70 px-3 py-1 text-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
            {user.email}
          </span>
          <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
            {role.toUpperCase()}
          </span>
        </div>
      </section>

      {error && (
        <div className="mt-4 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <section className="surface-card rounded-[30px] p-6">
          <h2 className="text-xl font-semibold">Profile</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Keep your display name current so activity and support requests are
            easier to understand.
          </p>

          <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />

            <input readOnly className="input" value={user.email ?? ""} />

            <button className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-white md:w-auto">
              {savingProfile ? "Saving…" : "Save Profile"}
            </button>

            {profileMsg && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {profileMsg}
              </p>
            )}
          </form>
        </section>

        <section className="surface-card rounded-[30px] p-6">
          <h2 className="text-xl font-semibold">Plan & Workspace</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Your current subscription and the main capabilities it unlocks.
          </p>

          <div className="mt-5 rounded-[28px] border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/50 dark:bg-sky-950/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
                  Current Plan
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
                  {planSummary.name}
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {planSummary.description}
                </p>
              </div>
              <span className="inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-800 dark:bg-sky-950/50 dark:text-sky-100">
                {orgName}
              </span>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              {planSummary.highlights.map((highlight) => (
                <li key={highlight}>• {highlight}</li>
              ))}
            </ul>

            <button
              onClick={async () => {
                if (!canManageBilling) return;

                const token = await auth.currentUser?.getIdToken();
                const res = await fetch("/api/stripe/create-portal", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ orgId }),
                });

                const data = await res.json();
                if (data?.url) window.location.href = data.url;
              }}
              disabled={!canManageBilling}
              className={`mt-5 w-full rounded-2xl px-4 py-3 text-white md:w-auto ${
                canManageBilling
                  ? "bg-sky-600 hover:bg-sky-700"
                  : "bg-slate-400"
              }`}
            >
              {canManageBilling ? "Manage Billing" : "Billing managed by an admin"}
            </button>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <section className="surface-card rounded-[30px] p-6">
          <h2 className="text-xl font-semibold">Notifications</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Control when Restok emails you about low or due items. More advanced
            notification routing can come later without changing your data.
          </p>

          <div className="mt-5 space-y-4">
            {[
              {
                label: "Email Notifications",
                value: emailNotifications,
                setter: setEmailNotifications,
                desc: "Receive item-related notification emails at your account address.",
              },
              {
                label: "Low Stock Alerts",
                value: lowStockAlerts,
                setter: setLowStockAlerts,
                desc: "Show item warnings and allow reminder emails for items running low or due.",
              },
            ].map((option) => (
              <div
                key={option.label}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/50"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">{option.label}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {option.desc}
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer">
                    <input
                      type="checkbox"
                      checked={option.value}
                      onChange={(e) => option.setter(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-6 w-11 rounded-full bg-slate-300 peer-checked:bg-sky-600 dark:bg-slate-700" />
                    <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
                  </label>
                </div>
              </div>
            ))}

            <button
              onClick={handleSavePrefs}
              className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-white md:w-auto"
            >
              {savingPrefs ? "Saving…" : "Save Preferences"}
            </button>

            {prefsMsg && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {prefsMsg}
              </p>
            )}
          </div>
        </section>

        <section className="surface-card rounded-[30px] p-6">
          <h2 className="text-xl font-semibold">Workspace Guide</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            A practical order for getting the most value from Restok.
          </p>

          <div className="mt-5 space-y-4">
            {quickStartSteps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/50"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-800 dark:bg-sky-950/50 dark:text-sky-100">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {step.title}
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {step.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <section className="surface-card rounded-[30px] p-6">
          <h2 className="text-xl font-semibold">Security</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Update your password and keep ownership rules intact.
          </p>

          <form onSubmit={handleChangePassword} className="mt-5 space-y-3">
            <input
              type="password"
              placeholder="Current password"
              className="input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />

            <input
              type="password"
              placeholder="New password"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Password must be at least 6 characters.
            </p>

            <button className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-white md:w-auto dark:bg-slate-100 dark:text-slate-900">
              Update Password
            </button>

            {passwordMsg && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {passwordMsg}
              </p>
            )}
          </form>
        </section>

        <section className="rounded-[30px] border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/20">
          <h2 className="text-xl font-semibold text-red-700 dark:text-red-300">
            Danger Zone
          </h2>
          <p className="mt-1 text-sm text-red-700/90 dark:text-red-300/90">
            Account deletion is permanent. Owners must transfer ownership first.
          </p>

          {role === "owner" && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-white/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              Transfer ownership in the Users page before deleting this account.
            </div>
          )}

          <form onSubmit={handleDeleteAccount} className="mt-5 space-y-3">
            <input
              type="password"
              placeholder="Password"
              className="input"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />

            <input
              type="text"
              placeholder='Type "DELETE" to confirm'
              className="input"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
            />

            <button
              disabled={deleteConfirmText !== "DELETE" || role === "owner"}
              className="w-full rounded-2xl bg-red-600 px-4 py-3 text-white disabled:opacity-50 md:w-auto"
            >
              Permanently Delete Account
            </button>
          </form>
        </section>
      </div>
    </motion.main>
  );
}
