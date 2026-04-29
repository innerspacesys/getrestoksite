"use client";

import Image from "next/image";
import Link from "next/link";

export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.svg"
            alt="Restok logo"
            width={40}
            height={40}
            className="shrink-0"
          />

          <div>
            <div className="font-semibold text-slate-900 dark:text-white">
              Restok
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Your office, always stocked.
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm md:flex">
          <Link href="/help" className="hover:text-slate-900 dark:hover:text-white">
            Help
          </Link>
          <Link
            href="/changelog"
            className="hover:text-slate-900 dark:hover:text-white"
          >
            Changelog
          </Link>
          <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white">
            Terms
          </Link>
          <Link href="/login" className="font-medium text-sky-600">
            Log in
          </Link>
          <Link
            href="/signup"
            className="button-primary !rounded-2xl !px-4 !py-2 text-sm"
          >
            Get Started
          </Link>
        </nav>
      </div>
    </header>
  );
}
