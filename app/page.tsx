"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { APP_DISPLAY_VERSION } from "@/lib/appMeta";
import { onAuthStateChanged } from "firebase/auth";

type RevealProps = {
  children: React.ReactNode;
  delay?: number;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

type PricingTierProps = {
  name: string;
  price: string;
  subtext: string;
  features: string[];
  cta: string;
  href: string;
  featured?: boolean;
};

type ItemBarProps = {
  label: string;
  status: string;
  percent: number;
  color: string;
};

type StepProps = {
  num: string;
  title: string;
  desc: string;
};

type FeatureProps = {
  title: string;
  desc: string;
};

type CardProps = {
  title: string;
  items: string[];
};

const Reveal = ({ children, delay = 0 }: RevealProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.5, delay }}
  >
    {children}
  </motion.div>
);

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [appRedirecting, setAppRedirecting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    const ua = navigator.userAgent || "";
    const isAppilix = /\bappilix\b/i.test(ua) || /App\{.*?\}/.test(ua);
    if (!isAppilix) return;

    const frame = window.requestAnimationFrame(() => {
      setAppRedirecting(true);
    });
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) router.replace("/dashboard");
      else router.replace("/login");
    });

    return () => {
      window.cancelAnimationFrame(frame);
      unsub();
    };
  }, [router]);

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    try {
      const inStandalone =
        Boolean((window.navigator as NavigatorWithStandalone).standalone) ||
        window.matchMedia("(display-mode: standalone)").matches;
      if (!inStandalone) return;

      const frame = window.requestAnimationFrame(() => {
        setAppRedirecting(true);
      });
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) router.replace("/dashboard");
        else router.replace("/login");
      });

      return () => {
        window.cancelAnimationFrame(frame);
        unsub();
      };
    } catch {
      // noop
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-transparent text-slate-800">
      {appRedirecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-md dark:bg-black/85">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
            <div className="text-sm text-slate-700 dark:text-slate-200">
              Opening app…
            </div>
          </div>
        </div>
      )}

      <motion.header
        className="sticky top-0 z-50 border-b border-white/50 bg-white/65 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/65"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.svg"
              alt="Restok logo"
              width={40}
              height={40}
              className="shrink-0"
              priority
            />

            <div>
              <div className="font-semibold text-slate-900 dark:text-white">
                Restok
              </div>
              <div className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
                Your office, always stocked.
              </div>
            </div>
          </Link>

          <button
            onClick={() => setMenuOpen(true)}
            className="text-2xl md:hidden"
            aria-label="Open menu"
          >
            ☰
          </button>

          <nav className="hidden items-center gap-3 text-sm md:flex">
            <a href="#features" className="hover:text-slate-900">
              Features
            </a>
            <a href="#how" className="hover:text-slate-900">
              How it works
            </a>
            <a href="#pricing" className="hover:text-slate-900">
              Pricing
            </a>
            <Link href="/help" className="hover:text-slate-900">
              Help
            </Link>
            <Link href="/changelog" className="hover:text-slate-900">
              Changelog
            </Link>
            <Link href="/terms" className="hover:text-slate-900">
              Terms
            </Link>
            <Link href="/login" className="text-sky-600 font-medium">
              Log in
            </Link>
            <Link
              href="/signup"
              className="button-primary ml-2 !rounded-2xl !px-4 !py-2 text-sm"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </motion.header>

      {menuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <motion.div
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute left-3 right-3 top-3 rounded-[28px] border border-white/40 bg-white/90 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/logo.svg"
                  alt="Restok logo"
                  width={36}
                  height={36}
                  className="shrink-0"
                />
                <div className="font-semibold text-slate-900 dark:text-white">
                  Restok
                </div>
              </Link>

              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="text-2xl"
              >
                ✕
              </button>
            </div>

            <nav className="mt-6 flex flex-col gap-3 text-lg">
              <a href="#features" className="block py-2">
                Features
              </a>
              <a href="#how" className="block py-2">
                How it works
              </a>
              <a href="#pricing" className="block py-2">
                Pricing
              </a>
              <Link href="/help" className="block py-2">
                Help
              </Link>
              <Link href="/changelog" className="block py-2">
                Changelog
              </Link>
              <Link href="/terms" className="block py-2">
                Terms
              </Link>
              <Link href="/login" className="block py-2 text-sky-600">
                Log in
              </Link>
              <Link
                href="/signup"
                className="button-primary mt-1 block !rounded-2xl text-center"
              >
                Get Started
              </Link>
            </nav>
          </motion.div>
        </div>
      )}

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-12 md:pt-16">
        <div className="grid items-center gap-12 md:grid-cols-[1.12fr_0.88fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="eyebrow">Restock planning for real teams</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-slate-950 dark:text-white md:text-6xl">
              Never forget to reorder the things your business depends on.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              Restok helps small businesses keep track of anything they reorder
              regularly using the vendors they already trust.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="button-primary">
                Get Started
              </Link>

              <a href="#pricing" className="button-secondary">
                Pricing
              </a>
            </div>

            <ul className="mt-8 grid grid-cols-1 gap-3 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
              <li className="surface-panel rounded-2xl px-4 py-3">
                ✅ Email reminders
              </li>
              <li className="surface-panel rounded-2xl px-4 py-3">
                ✅ Team access & multi-location
              </li>
              <li className="surface-panel rounded-2xl px-4 py-3">
                ✅ Smart prediction system
              </li>
              <li className="surface-panel rounded-2xl px-4 py-3">
                ✅ CSV export & analytics
              </li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            whileHover={{ scale: 1.01 }}
            className="surface-panel relative w-full max-w-xl overflow-hidden rounded-[32px] p-5"
          >
            <div className="absolute inset-x-5 top-5 h-24 rounded-full bg-sky-400/10 blur-3xl" />
            <DashboardMockup />
          </motion.div>
        </div>

        <section id="how" className="mt-20">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              How it works
            </h2>
          </Reveal>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <Reveal delay={0.1}>
              <Step
                num="1"
                title="Add items"
                desc="Add the supplies your business uses regularly."
              />
            </Reveal>
            <Reveal delay={0.2}>
              <Step
                num="2"
                title="Set cadence"
                desc="Tell Restok how long each item lasts, or let it learn."
              />
            </Reveal>
            <Reveal delay={0.3}>
              <Step
                num="3"
                title="Get reminded"
                desc="Receive automatic reminders before anything runs out."
              />
            </Reveal>
          </div>
        </section>

        <section id="features" className="mt-20">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Features
            </h2>
            <p className="mt-2 text-slate-600">
              Built for teams who want simplicity and reliability.
            </p>
          </Reveal>

          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [
                "Automatic Restock Alerts",
                "Daily checks and reminders before an item runs out.",
              ],
              [
                "Smart Predictions",
                "Usage-based predictions for reorder timing.",
              ],
              [
                "Team Access",
                "Invite staff and collaborate across your organization.",
              ],
              [
                "Supplier Tracking",
                "Keep supplier info next to every item.",
              ],
              [
                "Multi-location",
                "Manage multiple business locations easily.",
              ],
              ["Reports & Export", "CSV exports and light analytics."],
            ].map(([title, desc], i) => (
              <Reveal key={i} delay={i * 0.08}>
                <Feature title={title} desc={desc} />
              </Reveal>
            ))}
          </div>
        </section>

        <section className="surface-panel mt-20 rounded-[32px] p-8 md:p-10">
          <Reveal>
            <h2 className="text-2xl font-semibold">Before & After</h2>
          </Reveal>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <Reveal delay={0.1}>
              <Card
                title="Before Restok"
                items={[
                  "Missed orders & last-minute rush",
                  "Spreadsheets that get out of date",
                  "Lost time tracking suppliers",
                ]}
              />
            </Reveal>
            <Reveal delay={0.2}>
              <Card
                title="After Restok"
                items={[
                  "Automated reminders before items run out",
                  "Centralized cadence data",
                  "Faster reorders and less waste",
                ]}
              />
            </Reveal>
          </div>
        </section>

        <section id="pricing" className="mt-24">
          <Reveal>
            <h2 className="text-center text-3xl font-bold">
              Simple, transparent pricing
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
              Choose the plan that fits your business today and upgrade anytime.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <PricingTier
              name="Basic"
              price="$5.99"
              subtext="per month • $65 billed yearly ($5.42/mo)"
              features={[
                "Up to 5 items",
                "1 user",
                "1 location",
                "Email alerts",
                "Basic reports",
              ]}
              cta="Get Started"
              href="/signup?plan=basic"
            />

            <PricingTier
              name="Pro"
              price="$19"
              subtext="per month • $192 billed yearly ($16/mo)"
              features={[
                "10 items",
                "2 users",
                "2 locations",
                "Improved reports and metrics",
              ]}
              cta="Subscribe"
              href="/signup?plan=pro"
              featured
            />

            <PricingTier
              name="Premium"
              price="$39"
              subtext="per month • $396 billed yearly ($33/mo)"
              features={[
                "Unlimited items",
                "Unlimited users",
                "Unlimited locations",
                "SMS Alerts",
                "Advanced reports and metrics",
                "Priority onboarding and support",
              ]}
              cta="Subscribe"
              href="/signup?plan=premium"
            />
          </div>

          <div className="mx-auto mt-10 max-w-3xl">
            <div className="surface-panel flex flex-col items-center justify-between gap-4 rounded-[28px] p-6 md:flex-row">
              <div>
                <h3 className="text-lg font-semibold">Enterprise</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Custom pricing, unlimited locations, dedicated support.
                </p>
              </div>
              <Link
                href="/"
                className="button-secondary !rounded-2xl !py-2"
              >
                Coming soon! ETA Q1 2026
              </Link>
            </div>
          </div>
        </section>

        <Reveal>
          <section className="surface-panel mt-20 rounded-[32px] bg-gradient-to-r from-sky-100/60 via-white/70 to-white/60 py-12 text-center dark:from-sky-950/30 dark:via-slate-900/70 dark:to-slate-900/50">
            <h3 className="text-2xl font-semibold">
              Stop guessing when to reorder.
            </h3>
            <p className="mt-2 text-slate-600">
              Let Restok watch your supplies so you can focus on running your
              business.
            </p>
            <div className="mt-4">
              <Link href="/signup" className="button-primary">
                Subscribe Now
              </Link>
            </div>
          </section>
        </Reveal>
      </section>

      <Reveal>
        <footer className="mt-20 border-t border-white/40 py-8 dark:border-white/10">
          <div className="mx-auto grid max-w-7xl gap-6 px-6 text-sm text-slate-600 md:grid-cols-3">
            <div>
              <div className="font-semibold">Restok</div>
              <div className="mt-2">
                Smart restock reminders for small businesses.
              </div>
            </div>
            <div>
              <div className="font-semibold">Product</div>
              <ul className="mt-2 space-y-2">
                <li>
                  <a href="#features">Features</a>
                </li>
                <li>
                  <a href="#pricing">Pricing</a>
                </li>
                <li>
                  <Link href="/help">Help</Link>
                </li>
                <li>
                  <Link href="/changelog">Changelog</Link>
                </li>
                <li>
                  <Link href="/terms">Terms and Policies</Link>
                </li>
              </ul>
            </div>
            <div>
              <div className="font-semibold">Company</div>
              <ul className="mt-2 space-y-2">
                <li>
                  <Link href="/about">About</Link>
                </li>
                <li>
                  <Link href="/contact-us">Contact Us</Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-7xl px-6 text-center text-xs text-slate-400">
            © 2026{" "}
            <a href="https://www.issioffice.com">Inner Space Systems Inc.</a> —
            All rights reserved • {APP_DISPLAY_VERSION}
          </div>
        </footer>
      </Reveal>
    </main>
  );
}

function DashboardMockup() {
  return (
    <div className="relative z-10">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500">Warehouse</div>
          <div className="text-xl font-semibold text-slate-900">
            Office Supplies
          </div>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
          Updated 2h ago
        </div>
      </div>

      <ItemBar
        label="Paper Towels"
        status="Low — 2 days"
        percent={20}
        color="bg-amber-400"
      />
      <ItemBar
        label="Printer Toner"
        status="OK — 21 days"
        percent={60}
        color="bg-green-400"
      />
      <ItemBar
        label="Hand Soap"
        status="Due — today"
        percent={10}
        color="bg-red-400"
      />

      <div className="mt-6 flex items-center justify-between text-sm">
        <div className="text-slate-500">Next: Paper Towels</div>
        <button className="button-primary !rounded-xl !px-3 !py-1.5 text-xs">
          Reorder
        </button>
      </div>
    </div>
  );
}

function PricingTier({
  name,
  price,
  subtext,
  features,
  cta,
  href,
  featured = false,
}: PricingTierProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={`surface-card flex flex-col rounded-[30px] p-8 ${
        featured ? "border-sky-500 ring-2 ring-sky-100" : ""
      }`}
    >
      {featured && (
        <span className="mb-3 inline-block self-start rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-600">
          Most Popular
        </span>
      )}

      <h3 className="text-xl font-semibold">{name}</h3>

      <div className="mt-4">
        <span className="text-4xl font-extrabold">{price}</span>
        <span className="ml-1 text-slate-500">/mo</span>
      </div>

      <p className="mt-1 text-sm text-slate-500">{subtext}</p>

      <ul className="mt-6 space-y-3 text-sm text-slate-600">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-sky-600">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={href}
        className={`mt-8 inline-flex items-center justify-center rounded-2xl px-5 py-3 text-center font-medium ${
          featured
            ? "button-primary"
            : "button-secondary text-slate-800 dark:text-slate-100"
        }`}
      >
        {cta}
      </Link>
    </motion.div>
  );
}

function ItemBar({ label, status, percent, color }: ItemBarProps) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="flex items-center justify-between text-sm text-slate-600">
        <div>{label}</div>
        <div className="font-medium text-slate-800">{status}</div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-2 ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function Step({ num, title, desc }: StepProps) {
  return (
    <div className="surface-card rounded-[28px] p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 font-semibold text-sky-600 dark:bg-sky-950/40">
        {num}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{desc}</p>
    </div>
  );
}

function Feature({ title, desc }: FeatureProps) {
  return (
    <div className="surface-card rounded-[28px] p-6 transition hover:-translate-y-1">
      <div className="font-semibold">{title}</div>
      <p className="mt-2 text-sm text-slate-600">{desc}</p>
    </div>
  );
}

function Card({ title, items }: CardProps) {
  return (
    <div className="surface-card rounded-[28px] p-6">
      <h4 className="font-semibold">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        {items.map((item, idx) => (
          <li key={idx}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}
