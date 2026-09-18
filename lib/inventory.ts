/** Shared by the browser and reminder job. Existing items retain a 3-day warning. */
export type StockItem = {
  daysLast?: number;
  reminderDays?: number;
  createdAt?: { toDate(): Date } | null;
  lastRestockedAt?: { toDate(): Date } | null;
  orderStatus?: string;
};

export function daysRemaining(item: StockItem, now = Date.now()): number | null {
  const start = (item.lastRestockedAt ?? item.createdAt)?.toDate?.().getTime();
  if (!Number.isFinite(start) || !Number.isFinite(item.daysLast) || (item.daysLast ?? 0) <= 0) return null;
  return item.daysLast! - Math.floor(Math.max(0, now - start!) / 86400000);
}

export function reminderWindow(item: StockItem): number {
  return Number.isInteger(item.reminderDays) && item.reminderDays! >= 0 && item.reminderDays! <= 365
    ? item.reminderDays! : 3;
}

export function needsReorder(item: StockItem, now = Date.now()): boolean {
  const left = daysRemaining(item, now);
  return item.orderStatus !== "ordered" && left !== null && left <= reminderWindow(item);
}

export function stockLabel(item: StockItem, now = Date.now()): string {
  const left = daysRemaining(item, now);
  if (left === null) return "Schedule unavailable";
  if (left < 0) return `${Math.abs(left)} ${left === -1 ? "day" : "days"} overdue`;
  if (left === 0) return "Due today";
  return `${left} ${left === 1 ? "day" : "days"} left`;
}
