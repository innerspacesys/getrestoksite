"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PLANS } from "@/lib/plans";

export default function SignupPage() {
  const params = useSearchParams();
  const rawPlan = params.get("plan");
  const planKey = rawPlan ? rawPlan.toLowerCase().trim() : null;
  const initialPlan: keyof typeof PLANS =
    planKey && planKey in PLANS
      ? (planKey as keyof typeof PLANS)
      : "basic";

  const [selectedPlan, setSelectedPlan] =
    useState<keyof typeof PLANS>(initialPlan);
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function getErrorMessage(err: unknown) {
    return err instanceof Error ? err.message : "Signup failed";
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          orgName,
          phone,
          plan: selectedPlan,
          interval,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start checkout");
      }

      window.location.href = data.url;
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen px-4 pb-10 pt-5 md:px-6 md:pb-0 md:pt-0">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.18),transparent_40%)] dark:bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.16),transparent_36%)]" />

      <Link
        href="/"
        className="absolute left-4 top-5 z-10 text-sm font-medium text-sky-600 hover:underline dark:text-sky-300 md:left-6 md:top-6 md:text-base"
      >
        ← Back to Home
      </Link>

      <div className="flex min-h-screen items-start justify-center pt-16 md:items-center md:pt-0">
        <div className="surface-panel w-full max-w-md rounded-[30px] p-5 md:p-8">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-3xl bg-sky-100 text-2xl dark:bg-sky-950/50">
            ✨
          </div>

          <h1 className="text-center text-2xl font-bold leading-tight text-slate-950 dark:text-slate-50 md:text-3xl">
            Create your account
          </h1>

          <p className="mt-2 text-center text-sm text-zinc-500 dark:text-slate-400">
            Plan selected:{" "}
            <span className="font-medium capitalize">
              {PLANS[selectedPlan].name} -{" "}
              {interval === "monthly" ? "Monthly" : "Yearly"}
            </span>
          </p>

          {error && (
            <div className="mt-4 rounded-2xl bg-red-100 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-slate-300">
                Plan
              </label>
              <select
                value={selectedPlan}
                onChange={(e) =>
                  setSelectedPlan(e.target.value as keyof typeof PLANS)
                }
                className="input"
              >
                <option value="basic">Basic — 5 items</option>
                <option value="pro">Pro — 10 items/2 users</option>
                <option value="premium">
                  Premium — Unlimited items/users/locations
                </option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-slate-300">
                Billing Cycle
              </label>
              <select
                value={interval}
                onChange={(e) =>
                  setInterval(e.target.value as "monthly" | "yearly")
                }
                className="input"
              >
                <option value="monthly">Monthly — billed every month</option>
                <option value="yearly">Yearly — billed annually</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-slate-300">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-slate-300">
                Organization Name
              </label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-slate-300">
                Phone Number
              </label>
              <input
                type="tel"
                required
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-slate-300">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="button-primary w-full !rounded-2xl !py-3 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Loading..." : "Continue to Payment"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-zinc-600 dark:text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="text-sky-600 hover:underline dark:text-sky-300">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
