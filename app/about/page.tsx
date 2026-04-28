"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="antialiased text-slate-800 bg-white">

      {/* NAV */}
      <motion.header
        className="border-b py-4 sticky top-0 bg-white/90 z-50 dark:bg-slate-900/90 backdrop-blur"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="mx-auto max-w-7xl px-6 flex items-center justify-between">
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
              <div className="text-xs text-slate-500 dark:text-slate-400 -mt-1">
                Your office, always stocked.
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/#features" className="hover:text-slate-900">Features</Link>
            <Link href="/#how" className="hover:text-slate-900">How it works</Link>
            <Link href="/#pricing" className="hover:text-slate-900">Pricing</Link>
            <Link href="/terms" className="hover:text-slate-900">Terms</Link>
            <Link href="/login" className="text-sky-600 font-medium">Log in</Link>
            <Link
              href="/signup"
              className="ml-2 inline-block bg-sky-600 text-white px-4 py-2 rounded-lg shadow"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </motion.header>

      {/* ABOUT CONTENT */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <p className="text-slate-500">About Restok™</p>
          <h1 className="text-4xl font-bold mt-1">Our Story</h1>

          <div className="mt-6 space-y-5 text-slate-700 leading-relaxed">

            <p>
              Restok™ was created by Inner Space Systems, Inc. (ISSI) to solve a simple,
              everyday problem we’ve seen again and again while working with small
              businesses: important items get forgotten until it’s too late. Whether it’s
              office supplies, shop consumables, or parts that need regular reordering, the
              result is the same—last-minute stress and unnecessary disruption.
            </p>

            <p>
              After years of working directly with customers, we noticed that most businesses
              don’t need complex inventory systems or vendor lock-in. What they really need
              is a practical, reliable way to remember what they use regularly and when it’s
              time to reorder—using the vendors they already trust. That insight is what led
              us to build Restok™.
            </p>

            <p>
              Restok™ is intentionally simple. It’s designed to quietly support your workflow,
              not replace it. We don’t sell products, we don’t force suppliers, and we don’t
              overcomplicate things. We focus on reminders, clarity, and organization so you
              can stay ahead without extra effort.
            </p>

            <p>
              At its core, Restok™ exists to provide peace of mind. When fewer things fall
              through the cracks, businesses can spend less time reacting and more time
              focusing on the work that matters. That’s the goal—and it’s what guides
              everything we build.
            </p>
          </div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="border-t py-8 mt-16">
        <div className="mx-auto max-w-7xl px-6 grid md:grid-cols-3 gap-6 text-sm text-slate-600">
          <div>
            <div className="font-semibold">Restok</div>
            <div className="mt-2">Smart restock reminders for small businesses.</div>
          </div>

          <div>
            <div className="font-semibold">Product</div>
            <ul className="mt-2 space-y-2">
              <li><Link href="/#features">Features</Link></li>
              <li><Link href="/#pricing">Pricing</Link></li>
              <li><Link href="/terms">Terms and Policies</Link></li>
            </ul>
          </div>

          <div>
            <div className="font-semibold">Company</div>
            <ul className="mt-2 space-y-2">
              <li><Link href="/about">About</Link></li>
              <li><Link href="/contact-us">Contact Us</Link></li>
            </ul>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 mt-8 text-center text-xs text-slate-400">
          © 2026 <a href="https://www.issioffice.com">Inner Space Systems Inc.</a> — All rights reserved
        </div>
      </footer>
    </main>
  );
}
