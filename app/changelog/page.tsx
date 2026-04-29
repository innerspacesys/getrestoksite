import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import { CHANGELOG_ENTRIES } from "@/lib/changelog";

export default function ChangelogPage() {
  return (
    <main className="min-h-screen antialiased text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <PublicHeader />

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="surface-panel rounded-[32px] px-6 py-7 md:px-8">
          <span className="eyebrow">Release Notes</span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 md:text-4xl">
            Changelog
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
            A running record of the improvements shipping in Restok. The
            current version updates automatically at the top of this page.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {CHANGELOG_ENTRIES.map((entry, index) => (
            <section
              key={`${entry.version}-${entry.date}`}
              className="surface-card rounded-[30px] p-6"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
                    {index === 0 ? "Current release" : "Previous release"}
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    v{entry.version}
                  </h2>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {entry.date}
                  </div>
                </div>

                <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
                  {entry.title}
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300 md:text-base">
                {entry.summary}
              </p>

              <ul className="mt-5 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                {entry.items.map((item) => (
                  <li
                    key={item}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
