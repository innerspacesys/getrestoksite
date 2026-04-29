import { APP_RELEASE_DATE, APP_VERSION } from "@/lib/appMeta";

export type ChangelogEntry = {
  version: string;
  date: string;
  title: string;
  summary: string;
  items: string[];
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: APP_VERSION,
    date: APP_RELEASE_DATE,
    title: "Polished onboarding and product guidance",
    summary:
      "This release tightens the experience for both first-time visitors and day-to-day users.",
    items: [
      "Added a one-time onboarding walkthrough with skip and replay controls.",
      "Added public and in-app Help pages so setup guidance lives in one place.",
      "Upgraded dashboard page headers for a cleaner, more consistent feel.",
      "Improved reports with working analytics and stronger shopping-list support.",
      "Refined settings, theme consistency, and removed retired beta messaging.",
    ],
  },
  {
    version: "0.0.9",
    date: "2026-04-28",
    title: "Hardened account, billing, and email flows",
    summary:
      "Core account creation and communication flows were cleaned up for launch readiness.",
    items: [
      "Made the purchaser-created account the organization owner.",
      "Fixed org user-management routes and owner-protection behavior.",
      "Improved email templates for password setup, support, and alert messages.",
      "Removed build blockers caused by import-time secret initialization.",
    ],
  },
];
