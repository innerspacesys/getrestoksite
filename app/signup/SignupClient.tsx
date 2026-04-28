"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PLANS } from "@/lib/plans";

export default function SignupPage() {
  const params = useSearchParams();

  
  // -----------------------------
// PLAN SELECTION (FIXED)
// -----------------------------
const rawPlan = params.get("plan");
const planKey = rawPlan ? rawPlan.toLowerCase().trim() : null;

const initialPlan: keyof typeof PLANS =
  planKey && planKey in PLANS
    ? (planKey as keyof typeof PLANS)
    : "basic";

const [selectedPlan, setSelectedPlan] =
  useState<keyof typeof PLANS>(initialPlan);

  // -----------------------------
  // FORM STATE
  // -----------------------------
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

  // -----------------------------
  // SIGNUP HANDLER
  // -----------------------------
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

    // 🚀 Redirect to Stripe Checkout
    window.location.href = data.url;
  } catch (err: unknown) {
    console.error(err);
    setError(getErrorMessage(err));
    setLoading(false);
  }
}
     
  // -----------------------------
  // UI
  // -----------------------------
  return (
  <div className="relative min-h-screen bg-zinc-50 px-4 pb-10 pt-5 md:px-6 md:pb-0 md:pt-0">

    {/* BACK TO HOME — PAGE LEVEL */}
    <Link
      href="/"
      className="absolute left-4 top-5 z-10 text-sm font-medium text-sky-600 hover:underline md:left-6 md:top-6 md:text-base"
    >
      ← Back to Home
    </Link>

    {/* CENTERED SIGNUP CARD */}
    <div className="flex min-h-screen items-start justify-center pt-16 md:items-center md:pt-0">
    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow md:p-8">

        <h1 className="text-center text-2xl font-bold leading-tight text-slate-950 md:text-3xl">
          Create your account
        </h1>

        <p className="text-center text-sm text-zinc-500 mt-2">
          Plan selected:{" "}
          <span className="font-medium capitalize">
            {PLANS[selectedPlan].name} - {interval === "monthly" ? "Monthly" : "Yearly"}
          </span>
        </p>

        {error && (
          <div className="mt-4 bg-red-100 text-red-700 p-2 text-sm rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="mt-6 space-y-4">

          {/* PLAN */}
          <div>
            <label className="block text-sm font-medium text-zinc-700">
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

          {/* BILLING INTERVAL */}
<div>
  <label className="block text-sm font-medium text-zinc-700">
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

          {/* FULL NAME */}
          <div>
            <label className="block text-sm font-medium text-zinc-700">
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

          {/* ORG NAME */}
          <div>
            <label className="block text-sm font-medium text-zinc-700">
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

          {/* PHONE */}
<div>
  <label className="block text-sm font-medium text-zinc-700">
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

          {/* EMAIL */}
          <div>
            <label className="block text-sm font-medium text-zinc-700">
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
            className="w-full bg-sky-600 text-white py-3 rounded-lg font-medium hover:bg-sky-700 disabled:bg-sky-400"
          >
            {loading ? "Loading..." : "Continue to Payment"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-600 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-sky-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  </div>
);
}
