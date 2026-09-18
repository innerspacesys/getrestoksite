"use client";

import { useState } from "react";
import { auth } from "@/lib/auth/client";
import { db, doc, updateDoc } from "@/lib/data/client";
import { useOrgStore } from "@/lib/orgStore";
import { recordItemActivity } from "@/lib/itemActivity";
import {
  learnedSuggestion,
  needsReorder,
  snoozedUntilMs,
  type StockItem,
} from "@/lib/inventory";

type Action = "ordered" | "received" | "cancelled";
type Event = { id: string; action: Action; at: string; actorName: string };
const labels = { ordered: "Ordered", received: "Restocked", cancelled: "Order cancelled" };
const SNOOZE_OPTIONS = [
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
];

export default function ItemActions({
  item,
  now = Date.now(),
}: {
  item: StockItem & { id: string; name?: string };
  now?: number;
}) {
  const orgId = useOrgStore((s) => s.orgId);
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Event[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [fieldBusy, setFieldBusy] = useState(false);

  const snoozedMs = snoozedUntilMs(item, now);
  const dueForReorder = needsReorder(item, now);
  const suggestion = learnedSuggestion(item);

  async function save() {
    if (!confirm) return;
    setBusy(true); setError("");
    try { await recordItemActivity(item, confirm); setConfirm(null); setHistory(null); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to save. Please retry."); }
    finally { setBusy(false); }
  }

  async function updateItem(changes: Record<string, unknown>, fallback: string) {
    if (!orgId) return;
    setFieldBusy(true); setError("");
    try {
      await updateDoc(doc(db, "organizations", orgId, "items", item.id), changes);
      setSnoozeOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setFieldBusy(false);
    }
  }

  function snooze(days: number) {
    void updateItem(
      { snoozedUntil: new Date(now + days * 86400000).toISOString() },
      "Couldn't snooze this item. Please try again."
    );
  }

  function resumeReminders() {
    void updateItem({ snoozedUntil: null }, "Couldn't resume reminders. Please try again.");
  }

  function acceptEstimate() {
    if (suggestion == null) return;
    void updateItem({ daysLast: suggestion }, "Couldn't update the estimate. Please try again.");
  }

  async function loadHistory() {
    if (history) { setHistory(null); return; }
    setLoadingHistory(true); setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/items/activity?itemId=${encodeURIComponent(item.id)}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setHistory(data.events);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load history."); }
    finally { setLoadingHistory(false); }
  }

  return <div className="mt-3 space-y-3">
    {suggestion != null && (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/30">
        <p className="text-emerald-900 dark:text-emerald-100">
          📈 This supply usually lasts about <strong>{suggestion} days</strong> based on your last {item.restockCount} restocks — you set {item.daysLast}.
        </p>
        <button onClick={acceptEstimate} disabled={fieldBusy} className="button-primary mt-2 !px-3 !py-1.5 text-sm disabled:opacity-50">
          {fieldBusy ? "Updating…" : `Use ${suggestion} days`}
        </button>
      </div>
    )}
    <div className="flex flex-wrap gap-2">
      {item.orderStatus !== "ordered" ? <button className="button-secondary !px-3 !py-2 text-sm" onClick={() => { setError(""); setConfirm("ordered"); }}>Mark ordered</button> : <button className="button-secondary !px-3 !py-2 text-sm" onClick={() => { setError(""); setConfirm("cancelled"); }}>Cancel pending order</button>}
      <button className="button-primary !px-3 !py-2 text-sm" onClick={() => { setError(""); setConfirm("received"); }}>{item.orderStatus === "ordered" ? "Mark received" : "Mark restocked"}</button>
      {snoozedMs === null && dueForReorder && (
        <button className="button-secondary !px-3 !py-2 text-sm" onClick={() => { setError(""); setSnoozeOpen((open) => !open); }} aria-expanded={snoozeOpen}>Snooze</button>
      )}
      <button className="button-secondary !px-3 !py-2 text-sm" disabled={loadingHistory} onClick={loadHistory}>{loadingHistory ? "Loading…" : history ? "Hide history" : "History"}</button>
    </div>
    {snoozeOpen && snoozedMs === null && (
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
        <span className="text-sm text-slate-600 dark:text-slate-300">Remind me again in:</span>
        {SNOOZE_OPTIONS.map((option) => (
          <button key={option.days} onClick={() => snooze(option.days)} disabled={fieldBusy} className="button-secondary !px-3 !py-1.5 text-sm disabled:opacity-50">{option.label}</button>
        ))}
      </div>
    )}
    {snoozedMs !== null && (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/50">
        <span className="text-slate-600 dark:text-slate-300">💤 Snoozed until {new Date(snoozedMs).toLocaleDateString()}</span>
        <button onClick={resumeReminders} disabled={fieldBusy} className="text-sky-600 hover:underline disabled:opacity-50 dark:text-sky-300">Resume reminders</button>
      </div>
    )}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {history && <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <h4 className="font-semibold">Recent activity</h4>
      <p className="text-xs text-slate-500">Up to 50 recent events. History starts with your next order or restock.</p>
      {history.length ? <ul className="mt-2 space-y-2 text-sm">{history.map(event => <li key={event.id}>{labels[event.action]} · {event.actorName}<br /><time className="text-xs text-slate-500" dateTime={event.at}>{new Date(event.at).toLocaleString()}</time></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No activity recorded yet.</p>}
    </div>}
    {confirm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onKeyDown={e => { if (e.key === "Escape" && !busy) setConfirm(null); }}>
      <div role="dialog" aria-modal="true" aria-label={`${labels[confirm]}: ${item.name || "supply"}`} className="surface-panel w-full max-w-md rounded-3xl p-6">
        <h3 className="text-lg font-semibold">{confirm === "ordered" ? "Order placed?" : confirm === "received" ? "Supplies received?" : "Cancel this pending order?"}</h3>
        <p className="mt-3 text-sm">{item.name}</p>
        <p className="mt-2 text-sm text-slate-500">{confirm === "ordered" ? "This records an order you already placed. Reorder emails pause for this item until it is received or the pending order is cancelled." : confirm === "received" ? "Confirm the supplies are on hand. This restarts the countdown and records your name in the history." : "This only clears the pending status in Restok. Contact your vendor separately to cancel an actual order."}</p>
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex gap-3"><button autoFocus disabled={busy} onClick={() => setConfirm(null)} className="button-secondary">Go back</button><button disabled={busy} onClick={save} className="button-primary">{busy ? "Saving…" : "Confirm"}</button></div>
      </div>
    </div>}
  </div>;
}
