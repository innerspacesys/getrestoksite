import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

export default function PublicHelpPage() {
  return (
    <main className="min-h-screen antialiased text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <PublicHeader />

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="surface-panel rounded-[32px] px-6 py-7 md:px-8">
          <span className="eyebrow">Public Help</span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 md:text-4xl">
            Help
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
            A simple guide to what Restok does, how setup works, and how to get
            the most out of the app whether you are evaluating it or already
            using it.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="surface-card rounded-[30px] p-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Recommended setup order
            </h2>
            <div className="mt-5 space-y-4">
              {[
                {
                  title: "1. Add vendors first, or create them while adding items",
                  body:
                    "Some teams like entering suppliers up front. Others prefer speed and just create vendors from the Add Item form. Both approaches work.",
                },
                {
                  title: "2. Add the items you reorder most often",
                  body:
                    "Start with the things that cause real pain when they run out. Set a realistic cadence for how long each item usually lasts.",
                },
                {
                  title: "3. Add locations if your team uses multiple spaces",
                  body:
                    "Locations can be storage rooms, departments, or offices. They help make restock reviews and reports easier to act on.",
                },
                {
                  title: "4. Use Restock as your action queue",
                  body:
                    "Restock is where your team reviews items that need attention and takes action through saved vendor emails or websites.",
                },
                {
                  title: "5. Use Reports for shopping lists and visibility",
                  body:
                    "Reports can help you prepare store pickup runs, and higher plans unlock deeper analytics for planning.",
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
                What each section does
              </h2>
              <div className="mt-5 space-y-3">
                {[
                  ["Items", "Track what you buy, how long it lasts, and where it belongs."],
                  ["Vendors", "Keep supplier contact details close to the items you reorder."],
                  ["Locations", "Organize inventory by room, department, or physical site."],
                  ["Restock", "See what needs attention and act on it."],
                  ["Reports", "Build shopping lists and get more insight on supported plans."],
                  ["Settings", "Manage profile, notifications, billing, and account security."],
                ].map(([title, body]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-slate-200/80 px-4 py-3 dark:border-slate-700"
                  >
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {title}
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {body}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="surface-card rounded-[30px] p-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Need more detail later?
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                This page is intentionally lightweight for now. We can keep
                adding FAQs, screenshots, setup examples, and plan-specific
                details over time.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="button-primary !rounded-2xl !px-4 !py-2.5 text-sm"
                >
                  Start with Restok
                </Link>
                <Link
                  href="/contact-us"
                  className="button-secondary !rounded-2xl !px-4 !py-2.5 text-sm"
                >
                  Contact support
                </Link>
              </div>
            </section>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
