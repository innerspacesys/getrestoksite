"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useOrgData } from "@/lib/useOrgData";

type TourStep = {
  id: string;
  target?: string;
  title: string;
  body: string;
};

type Rect = { top: number; left: number; width: number; height: number } | null;

function getTourSteps(plan: string | null): TourStep[] {
  const base: TourStep[] = [
    {
      id: "welcome",
      title: "Welcome to Restok",
      body:
        "This walkthrough shows the fastest way to get value from the app. You can skip it, but that is not recommended for a first pass.",
    },
    {
      id: "vendors",
      target: "vendors",
      title: "Start with Vendors if you want a cleaner setup",
      body:
        "Add your suppliers here first if you want their email, website, and pickup info ready before you begin tracking items.",
    },
    {
      id: "items",
      target: "items",
      title: "Items are the core of the app",
      body:
        "Track the supplies you actually reorder, set how long they usually last, and add a vendor inline if you did not set vendors up first.",
    },
    {
      id: "locations",
      target: "locations",
      title: "Locations help organize your workflow",
      body:
        "Use locations for rooms, departments, or storage spots so alerts, reports, and restock reviews are easier to act on.",
    },
  ];

  if (plan === "pro" || plan === "premium" || plan === "enterprise") {
    base.push({
      id: "users",
      target: "users",
      title: "Bring in another teammate on Pro and above",
      body:
        "Pro gives you room for one more user and up to two locations, which makes it easier to split restock responsibility.",
    });
  }

  base.push({
    id: "restock",
    target: "restock",
    title: "Restock is where work actually happens",
    body:
      "Use Restock as your action queue. It gathers items that need attention so you can reorder them through vendor emails or supplier sites.",
  });

  if (plan === "pro" || plan === "premium" || plan === "enterprise") {
    base.push({
      id: "reports",
      target: "reports",
      title: "Reports gives you shopping lists and analytics",
      body:
        "Print a store shopping list for pickup runs and use analytics to spot risky items, vendor concentration, and coverage by location.",
    });
  }

  base.push(
    {
      id: "settings",
      target: "settings",
      title: "Settings handles account, billing, and preferences",
      body:
        "Use Settings for your profile, notifications, billing access, and general account management once your workspace is up and running.",
    },
    {
      id: "help",
      target: "help",
      title: "Help is where you come back later",
      body:
        "If you want a refresher later, the Help page keeps the setup order and feature explanations in one place without popping up again.",
    }
  );

  return base;
}

export default function OnboardingWalkthrough() {
  const { plan } = useOrgData();
  const searchParams = useSearchParams();
  const [uid, setUid] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect>(null);

  const forceTour = searchParams.get("tour") === "1";
  const steps = useMemo(() => getTourSteps(plan), [plan]);
  const currentStep = steps[stepIndex];
  const isMobileViewport =
    typeof window !== "undefined" ? window.innerWidth < 768 : false;

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setUid(user?.uid ?? null);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;

    const key = `restok_onboarding_status_${uid}`;
    const saved = localStorage.getItem(key);
    const frame = window.requestAnimationFrame(() => {
      if (forceTour) {
        setStepIndex(0);
        setOpen(true);
        return;
      }

      if (!saved) {
        setStepIndex(0);
        setOpen(true);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [forceTour, uid]);

  useEffect(() => {
    if (!open || !currentStep?.target) {
      const frame = window.requestAnimationFrame(() => {
        setTargetRect(null);
      });

      return () => window.cancelAnimationFrame(frame);
    }

    if (window.innerWidth < 768) {
      const frame = window.requestAnimationFrame(() => {
        setTargetRect(null);
      });

      return () => window.cancelAnimationFrame(frame);
    }

    let highlightedTarget: HTMLElement | null = null;
    let highlightedScope: HTMLElement | null = null;

    function updateRect() {
      const target = document.querySelector<HTMLElement>(
        `[data-onboarding-target="${currentStep.target}"]`
      );

      if (!target) {
        setTargetRect(null);
        return;
      }

      const scope = target.closest<HTMLElement>("[data-onboarding-scope]");
      if (highlightedScope !== scope) {
        highlightedScope?.removeAttribute("data-onboarding-active-scope");
        scope?.setAttribute("data-onboarding-active-scope", "true");
        highlightedScope = scope;
      }

      if (highlightedTarget !== target) {
        highlightedTarget?.removeAttribute("data-onboarding-active-target");
        target.setAttribute("data-onboarding-active-target", "true");
        highlightedTarget = target;
      }

      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
      });
    }

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      highlightedTarget?.removeAttribute("data-onboarding-active-target");
      highlightedScope?.removeAttribute("data-onboarding-active-scope");
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [currentStep, open]);

  if (!open || !uid) return null;

  function finish(status: "dismissed" | "completed") {
    localStorage.setItem(`restok_onboarding_status_${uid}`, status);
    setOpen(false);
  }

  function next() {
    if (stepIndex >= steps.length - 1) {
      finish("completed");
      return;
    }

    setStepIndex((current) => current + 1);
  }

  function back() {
    setStepIndex((current) => Math.max(0, current - 1));
  }

  const cardStyle =
    targetRect && typeof window !== "undefined" && window.innerWidth >= 1024
      ? {
          top: Math.max(24, Math.min(targetRect.top, window.innerHeight - 360)),
          left: Math.min(
            targetRect.left + targetRect.width + 24,
            window.innerWidth - 400
          ),
        }
      : undefined;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <div className="absolute inset-0 hidden bg-slate-950/58 backdrop-blur-[2px] md:block" />

      {targetRect && (
        <div
          className="pointer-events-none absolute rounded-[26px] border-2 border-sky-300 transition-all duration-200"
          style={targetRect}
        />
      )}

      <div
        className="absolute inset-x-4 bottom-4 top-auto md:inset-auto md:w-[360px]"
        style={cardStyle}
      >
        <div className="pointer-events-auto surface-panel rounded-[30px] p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
                Onboarding walkthrough
              </div>
              <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Step {stepIndex + 1} of {steps.length}
              </div>
            </div>

            <button
              type="button"
              onClick={() => finish("dismissed")}
              className="rounded-full px-2 py-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Close walkthrough"
            >
              ✕
            </button>
          </div>

          <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
            {currentStep.title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {currentStep.body}
          </p>

          {isMobileViewport && currentStep.target && (
            <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
              On mobile, use the navigation controls to open the right section
              and visit this page.
            </div>
          )}

          {stepIndex === 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              You can skip this and it will not show again, but new users usually
              get more value faster if they go through it once.
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => finish("dismissed")}
              className="button-secondary !rounded-2xl !px-4 !py-2.5 text-sm"
            >
              Skip for now
            </button>

            {stepIndex > 0 && (
              <button
                type="button"
                onClick={back}
                className="button-secondary !rounded-2xl !px-4 !py-2.5 text-sm"
              >
                Back
              </button>
            )}

            <button
              type="button"
              onClick={next}
              className="button-primary ml-auto !rounded-2xl !px-4 !py-2.5 text-sm"
            >
              {stepIndex === steps.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
