"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import {
  onAuthStateChanged,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateProfile,
  deleteUser,
} from "firebase/auth";
import { doc, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
import { motion } from "framer-motion";

export const PLANS = {
  basic: { name: "Basic", description: "Manual tracking with limited alerts" },
  pro: { name: "Pro", description: "Automated alerts and smart reminders" },
  premium: { name: "Premium", description: "Advanced automation + reporting" },
  enterprise: { name: "Enterprise", description: "Custom + priority support" },
};



export default function SettingsPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Profile
  const [name, setName] = useState("");

  // Preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [lowStockAlerts, setLowStockAlerts] = useState(true);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  // Delete
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [error, setError] = useState<string | null>(null);

  // Billing
  const [plan, setPlan] = useState<keyof typeof PLANS>("basic");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [role, setRole] = useState<"owner" | "admin" | "member">("member");
  const [planLoaded, setPlanLoaded] = useState(false);

  // ---------------- AUTH ----------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) return router.push("/login");
      setUser(u);
      setLoadingUser(false);
    });

    return () => unsub();
  }, [router]);

  // ---------------- PROFILE ----------------
  useEffect(() => {
    if (!user) return;

    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      const data = (snap.data() || {}) as {
        name?: string;
        emailNotifications?: boolean;
        lowStockAlerts?: boolean;
      };
      setName(data.name || user.displayName || "");
      setEmailNotifications(data.emailNotifications ?? true);
      setLowStockAlerts(data.lowStockAlerts ?? true);
    });

    return () => unsub();
  }, [user]);

  // ---------------- ORG + PLAN ----------------
  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      const data = snap.data();
      if (!data?.orgId) return;

      setOrgId(data.orgId);
      setRole(
        data.role === "owner" || data.role === "admin" ? data.role : "member"
      );

      const orgRef = doc(db, "organizations", data.orgId);
      const unsubOrg = onSnapshot(orgRef, (orgSnap) => {
        const rawPlan = orgSnap.data()?.plan;
        setPlan(
          rawPlan === "pro" ||
          rawPlan === "premium" ||
          rawPlan === "enterprise"
            ? rawPlan
            : "basic"
        );
        setPlanLoaded(true);
      });

      return () => unsubOrg();
    });

    return () => unsub();
  }, [user]);

  // Scroll to #billing when linked
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const el = document.querySelector(hash);
    if (!el) return;

    setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
  }, []);

  // ---------------- ACTIONS ----------------
  function getErrorMessage(err: unknown, fallback: string) {
    return err instanceof Error ? err.message : fallback;
  }

  async function handleSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    setError(null);

    try {
      if (name.trim()) {
        await updateProfile(user, { displayName: name.trim() });
        await updateDoc(doc(db, "users", user.uid), { name: name.trim() });
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to save profile."));
    }

    setSavingProfile(false);
  }

  async function handleSavePrefs() {
    if (!user) return;

    setSavingPrefs(true);
    setError(null);

    try {
      await updateDoc(doc(db, "users", user.uid), {
        emailNotifications,
        lowStockAlerts,
      });
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

  // ---------------- LOADING ----------------
  if (loadingUser || !planLoaded) {
    return (
      <motion.main
        className="flex-1 min-h-screen flex items-center justify-center text-slate-500"
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-sky-500 border-t-transparent" />
          Loading settings…
        </div>
      </motion.main>
    );
  }

  if (!user) {
    return null;
  }

  // ---------------- UI ----------------
  return (
    <motion.main
      className="flex-1 p-4 md:p-10 text-slate-800 dark:text-slate-100"
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <h1 className="text-3xl font-bold">Settings</h1>

      <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Signed in as{" "}
        <span className="font-medium">
          {user.displayName || name || "User"}
        </span>{" "}
        • {user.email}
      </div>

      {error && (
        <div className="mt-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-4 py-2 rounded">
          {error}
        </div>
      )}

      {/* PROFILE */}
      <section className="mt-8 bg-white dark:bg-slate-800 p-6 rounded-xl border max-w-full md:max-w-2xl">
        <h2 className="text-xl font-semibold">Profile</h2>

        <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
          />

          <input readOnly className="input" value={user.email ?? ""} />

          <button className="w-full md:w-auto px-4 py-2 bg-sky-600 text-white rounded-lg">
            {savingProfile ? "Saving…" : "Save Profile"}
          </button>
        </form>
      </section>

      {/* PREFS */}
      <section className="mt-8 bg-white dark:bg-slate-800 p-6 rounded-xl border max-w-full md:max-w-2xl">
        <h2 className="text-xl font-semibold">Preferences</h2>

        <div className="mt-4 space-y-4">
          {[{
            label: "Email Notifications",
            value: emailNotifications,
            setter: setEmailNotifications,
            desc: "Receive email alerts for low or due items."
          },{
            label: "Low Stock Alerts",
            value: lowStockAlerts,
            setter: setLowStockAlerts,
            desc: "Show warnings when items are nearly empty."
          }].map(opt => (
            <div key={opt.label} className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-slate-500">{opt.desc}</div>
              </div>
              <label className="relative inline-flex cursor-pointer">
                <input
                  type="checkbox"
                  checked={opt.value}
                  onChange={e => opt.setter(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 rounded-full peer-checked:bg-sky-600"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5" />
              </label>
            </div>
          ))}

          <button
            onClick={handleSavePrefs}
            className="w-full md:w-auto px-4 py-2 bg-sky-600 text-white rounded-lg"
          >
            {savingPrefs ? "Saving…" : "Save Preferences"}
          </button>
        </div>
      </section>

      {/* BILLING */}
      <section
        id="billing"
        className="mt-8 bg-white dark:bg-slate-800 p-6 rounded-xl border max-w-full md:max-w-2xl"
      >
        <h2 className="text-xl font-semibold">Billing</h2>

        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          Current Plan: <strong>{PLANS[plan].name}</strong>
        </p>

        <button
          onClick={async () => {
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
          className="mt-4 w-full md:w-auto px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg"
        >
          Manage Billing
        </button>
      </section>

      {/* SECURITY */}
      <section className="mt-8 bg-white dark:bg-slate-800 p-6 rounded-xl border max-w-full md:max-w-2xl">
        <h2 className="text-xl font-semibold">Security</h2>

        <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
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

          <p className="text-xs text-slate-500">
            Password must be at least 6 characters.
          </p>

          <button className="w-full md:w-auto px-4 py-2 bg-slate-800 text-white rounded-lg">
            Update Password
          </button>

          {passwordMsg && (
            <p className="text-xs text-emerald-500">{passwordMsg}</p>
          )}
        </form>

        {/* Danger Zone */}
        <div className="mt-6 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-4 rounded-lg">
          <div className="font-semibold text-red-600 mb-2">Danger Zone</div>
          {role === "owner" && (
            <p className="mb-3 text-sm text-red-700 dark:text-red-300">
              Transfer ownership before deleting this account.
            </p>
          )}

          <form onSubmit={handleDeleteAccount} className="space-y-3">
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
              className="w-full md:w-auto px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
            >
              Permanently Delete Account
            </button>
          </form>
        </div>
      </section>
    </motion.main>
  );
}
