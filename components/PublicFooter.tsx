import Link from "next/link";
import { getPublicAppMeta } from "@/lib/appMeta";

export default function PublicFooter() {
  const appMeta = getPublicAppMeta();

  return (
    <footer className="mt-16 border-t border-slate-200/80 py-8 dark:border-slate-800">
      <div className="mx-auto grid max-w-7xl gap-6 px-6 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-4">
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">
            Restok
          </div>
          <div className="mt-2">
            Smart restock reminders for small businesses.
          </div>
        </div>

        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">
            Product
          </div>
          <ul className="mt-2 space-y-2">
            <li>
              <Link href="/help">Help</Link>
            </li>
            <li>
              <Link href="/terms">Terms and Policies</Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">
            Company
          </div>
          <ul className="mt-2 space-y-2">
            <li>
              <Link href="/about">About</Link>
            </li>
            <li>
              <Link href="/contact-us">Contact Us</Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">
            Version
          </div>
          <div className="mt-2">{appMeta.displayVersion}</div>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-7xl px-6 text-center text-xs text-slate-400">
        © 2026{" "}
        <a href="https://www.issioffice.com">Inner Space Systems Inc.</a> — All
        rights reserved
      </div>
    </footer>
  );
}
