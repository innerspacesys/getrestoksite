"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { recordItemActivity } from "@/lib/itemActivity";
import type { StockItem } from "@/lib/inventory";

type Action = "ordered" | "received" | "cancelled";
type Event = { id: string; action: Action; at: string; actorName: string };
const labels = { ordered: "Ordered", received: "Restocked", cancelled: "Order cancelled" };

export default function ItemActions({ item }: { item: StockItem & { id: string; name?: string } }) {
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Event[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  async function save() {
    if (!confirm) return;
    setBusy(true); setError("");
    try { await recordItemActivity(item, confirm); setConfirm(null); setHistory(null); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to save. Please retry."); }
    finally { setBusy(false); }
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
    <div className="flex flex-wrap gap-2">
      {item.orderStatus !== "ordered" ? <button className="button-secondary !px-3 !py-2 text-sm" onClick={() => { setError(""); setConfirm("ordered"); }}>Mark ordered</button> : <button className="button-secondary !px-3 !py-2 text-sm" onClick={() => { setError(""); setConfirm("cancelled"); }}>Cancel pending order</button>}
      <button className="button-primary !px-3 !py-2 text-sm" onClick={() => { setError(""); setConfirm("received"); }}>{item.orderStatus === "ordered" ? "Mark received" : "Mark restocked"}</button>
      <button className="button-secondary !px-3 !py-2 text-sm" disabled={loadingHistory} onClick={loadHistory}>{loadingHistory ? "Loading…" : history ? "Hide history" : "History"}</button>
    </div>
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
