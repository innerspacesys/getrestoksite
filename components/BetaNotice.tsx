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
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={acknowledge}   // clicking backdrop also dismisses
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-slate-800 p-6 rounded-xl w-full max-w-2xl space-y-4 shadow-2xl"
          >
            <h2 className="text-xl font-bold">
              Restok Beta Notice
            </h2>

            <p className="text-sm leading-relaxed">
              Restok is currently in a beta testing phase and is provided
              for evaluation and feedback purposes only. Restok helps
              businesses track and receive reminders for items they reorder
              regularly. Restok does not sell products, process purchases,
              or require you to use any specific vendor.
            </p>

            <ul className="text-sm list-disc pl-5 leading-relaxed">
              <li>Features may change or be removed</li>
              <li>Data may be reset</li>
              <li>Availability and performance are not guaranteed</li>
            </ul>

            <p className="text-sm leading-relaxed">
              Restok provides reminders and organizational tools only.
              You are responsible for purchasing decisions, inventory
              levels, and supplier relationships. Please do not rely
              on Restok as your sole system for critical inventory
              decisions during beta.
            </p>

            <div className="flex justify-end">
              <button
                onClick={acknowledge}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white"
              >
                I Understand
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
