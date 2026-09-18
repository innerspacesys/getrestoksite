/** Shared by the browser and reminder job. Existing items retain a 3-day warning. */
export type StockItem = {
  daysLast?: number;
  reminderDays?: number;
  createdAt?: { toDate(): Date } | null;
  lastRestockedAt?: { toDate(): Date } | null;
  orderStatus?: string;
  // Reminders paused until this time (a snooze). ISO string or Timestamp-like.
  snoozedUntil?: string | { toDate(): Date } | null;
  // Learned from actual restocks: rolling estimate + how many cycles seen.
  learnedDays?: number;
  restockCount?: number;
};

function toMillis(value?: string | { toDate(): Date } | null): number | null {
  if (!value) return null;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  const t = value.toDate?.().getTime();
  return Number.isFinite(t) ? t! : null;
}

export function daysRemaining(item: StockItem, now = Date.now()): number | null {
  const start = (item.lastRestockedAt ?? item.createdAt)?.toDate?.().getTime();
  if (!Number.isFinite(start) || !Number.isFinite(item.daysLast) || (item.daysLast ?? 0) <= 0) return null;
  return item.daysLast! - Math.floor(Math.max(0, now - start!) / 86400000);
}

export function reminderWindow(item: StockItem): number {
  return Number.isInteger(item.reminderDays) && item.reminderDays! >= 0 && item.reminderDays! <= 365
    ? item.reminderDays! : 3;
}

/** Returns the snooze deadline (ms) if the item is currently snoozed, else null. */
export function snoozedUntilMs(item: StockItem, now = Date.now()): number | null {
  const ms = toMillis(item.snoozedUntil);
  return ms != null && ms > now ? ms : null;
}

export function needsReorder(item: StockItem, now = Date.now()): boolean {
  if (item.orderStatus === "ordered") return false;
  if (snoozedUntilMs(item, now) !== null) return false;
  const left = daysRemaining(item, now);
  return left !== null && left <= reminderWindow(item);
}

/**
 * If actual restocks show the supply lasts a meaningfully different number of
 * days than the user set, return the suggested day count — else null. Requires
 * at least two completed restock cycles so a single fluke can't drive it.
 */
export function learnedSuggestion(item: StockItem): number | null {
  const learned = Math.round(Number(item.learnedDays));
  const current = Number(item.daysLast);
  const count = Number(item.restockCount);
  if (!Number.isFinite(learned) || learned < 1 || !Number.isFinite(current) || current < 1) return null;
  if (!(count >= 2)) return null;
  const diff = Math.abs(learned - current);
  if (diff < 2 || diff / current < 0.1) return null;
  return learned;
}

export function stockLabel(item: StockItem, now = Date.now()): string {
  const left = daysRemaining(item, now);
  if (left === null) return "Schedule unavailable";
  if (left < 0) return `${Math.abs(left)} ${left === -1 ? "day" : "days"} overdue`;
  if (left === 0) return "Due today";
  return `${left} ${left === 1 ? "day" : "days"} left`;
}
