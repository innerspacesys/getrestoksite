"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function BetaNotice() {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("restok_beta_ack");
  });

  function acknowledge() {
    sessionStorage.setItem("restok_beta_ack", "true");
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="mx-3 mt-3 rounded-3xl border border-amber-200 bg-amber-50/95 px-4 py-4 text-slate-900 shadow-sm md:mx-6 md:px-5 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-50"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                Restok Beta Notice
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-amber-50/85">
                Restok is currently in beta for evaluation and feedback. Features
                may change, data may be reset, and availability is not guaranteed.
                Restok provides reminders and organization tools only, so please
                don&apos;t rely on it as your sole system for critical inventory decisions.
              </p>
            </div>

            <div className="flex shrink-0">
              <button
                onClick={acknowledge}
                className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
              >
                I Understand
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
