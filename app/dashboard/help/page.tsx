"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useOrgData } from "@/lib/useOrgData";

export default function HelpPage() {
  const { plan } = useOrgData();
  const isProPlus =
    plan === "pro" || plan === "premium" || plan === "enterprise";

  return (
    <motion.main
      className="mx-auto flex-1 max-w-6xl p-4 md:p-10"
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
    >
      <section className="surface-panel rounded-[32px] px-6 py-7 md:px-8">
        <span className="eyebrow">Help Center</span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 md:text-4xl">
          Help
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
          Everything important in one place: how to get set up, what each page
          does, and where to go when you need a refresher.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/dashboard?tour=1"
            className="button-primary !rounded-2xl !px-4 !py-2.5 text-sm"
          >
            Replay onboarding walkthrough
          </Link>
          <Link
            href="/dashboard/settings"
            className="button-secondary !rounded-2xl !px-4 !py-2.5 text-sm"
          >
            Open settings
          </Link>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="surface-card rounded-[30px] p-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Recommended setup order
          </h2>
          <div className="mt-5 space-y-4">
            {[
              {
                title: "1. Vendors first, or add them inline",
                body:
                  "If you like clean setup, add vendors before anything else. If you prefer speed, just create the vendor from the Add Item form while you work.",
              },
              {
                title: "2. Add the items you reorder most often",
                body:
                  "Start with the products that actually cause pain when they run out. Set a realistic number of days each item usually lasts.",
              },
              {
                title: "3. Add locations if they help your workflow",
                body:
                  "Locations can be rooms, departments, or storage areas. They are optional, but they make restock review and reporting clearer.",
              },
              {
                title: "4. Use Restock as your action queue",
                body:
                  "Restock is where the tracking becomes useful. It gathers items that need attention so you can reorder them through saved vendor details.",
              },
              {
                title: isProPlus
                  ? "5. Use Reports for shopping lists and analytics"
                  : "5. Use Reports when you upgrade for deeper insight",
                body: isProPlus
                  ? "Reports lets you print a store shopping list and review analytics like item risk, vendor concentration, and location coverage."
                  : "Reports becomes much more powerful on Pro and above, where analytics and richer planning views help you spot issues earlier.",
              },
              {
                title: "6. Fine-tune Settings last",
                body:
                  "Once the workspace is running, use Settings for profile changes, notifications, billing access, and account security.",
              },
            ].map((step) => (
              <div
                key={step.title}
                className="rounded-[26px] border border-slate-200/80 bg-slate-50/80 px-5 py-4 dark:border-slate-700 dark:bg-slate-900/50"
              >
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <section className="surface-card rounded-[30px] p-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              What each page is for
            </h2>
            <div className="mt-5 space-y-3 text-sm">
              {[
                ["Items", "Track what you buy, how long it lasts, and where it belongs."],
                ["Vendors", "Store supplier info for email, websites, and pickup planning."],
                ["Locations", "Organize inventory by room, department, or storage area."],
                ["Restock", "Review what needs action and reorder it."],
                ["Reports", "Print shopping lists and review analytics on supported plans."],
                ["Users", "Invite teammates and manage ownership or admin access."],
                ["Settings", "Handle profile, notifications, billing, and security."],
              ].map(([title, body]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-slate-200/80 px-4 py-3 dark:border-slate-700"
                >
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {title}
                  </div>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card rounded-[30px] p-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Need something else?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Use the Support button in the sidebar anytime if something looks
              wrong, billing needs attention, or you want help deciding how to
              organize your workspace.
            </p>
          </section>
        </div>
      </div>
    </motion.main>
  );
}
