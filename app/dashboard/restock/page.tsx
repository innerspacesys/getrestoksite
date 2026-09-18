"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { useOrgData } from "@/lib/useOrgData";
import { daysRemaining, needsReorder, stockLabel, type StockItem } from "@/lib/inventory";
import { useInventoryClock } from "@/lib/useInventoryClock";
import ItemActions from "@/components/ItemActions";

type Item = StockItem & { id: string; name: string; vendorId?: string; locationId?: string; orderedByName?: string; orderedAt?: { toDate(): Date } };
type VendorDoc = { id: string; name: string; email?: string; website?: string };

export default function RestockPage() {
  const { items, vendors, locations, loading } = useOrgData();
  const now = useInventoryClock();
  const [filter, setFilter] = useState<"attention" | "ordered" | "all">("all");
  const typedItems = items as Item[];
  const pending = typedItems.filter(item => item.orderStatus === "ordered");
  const attention = typedItems.filter(item => needsReorder(item, now));
  const visible = (filter === "ordered" ? pending : filter === "attention" ? attention : typedItems).slice().sort((a, b) => (daysRemaining(a, now) ?? Infinity) - (daysRemaining(b, now) ?? Infinity));
  function normalizeWebsite(url?: string) {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `https://${url}`;
  }

  function buildVendorSearchUrl(vendor: VendorDoc, itemName: string) {
    if (!vendor.website) return null;

    const site = normalizeWebsite(vendor.website)!;
    const q = encodeURIComponent(itemName);
    const host = site.toLowerCase();

    if (host.includes("amazon")) return `https://www.amazon.com/s?k=${q}`;
    if (host.includes("walmart")) return `https://www.walmart.com/search?q=${q}`;
    if (host.includes("staples")) return `https://www.staples.com/search?query=${q}`;
    if (host.includes("officedepot"))
      return `https://www.officedepot.com/catalog/search.do?query=${q}`;
    if (host.includes("costco"))
      return `https://www.costco.com/CatalogSearch?keyword=${q}`;

    // Fallback: search vendor site via Google
    try {
      const hostName = new URL(site).hostname;
      return `https://www.google.com/search?q=site:${encodeURIComponent(
        hostName
      )}+${q}`;
    } catch {
      // If URL() fails, just do a plain search
      return `https://www.google.com/search?q=${q}`;
    }
  }


  function vendorEmail(vendor: VendorDoc, item: Item) {
    const body = `Hello ${vendor.name},\n\nI would like to place a restock order for:\n${item.name}\n\nThank you,\n${auth.currentUser?.displayName || auth.currentUser?.email || ""}`;
    return `mailto:${vendor.email}?subject=${encodeURIComponent(`Restock Request - ${item.name}`)}&body=${encodeURIComponent(body)}`;
  }
  if (loading) return <p className="p-8">Loading supplies…</p>;
  return <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">
    <section className="surface-panel rounded-[32px] p-6 md:p-8">
      <span className="eyebrow">Reorder & receive</span>
      <h1 className="mt-3 text-3xl font-bold">Restock supplies</h1>
      <p className="mt-3 text-slate-500">Place an order with your vendor, mark it ordered, then confirm when the supplies arrive.</p>
      <p className="mt-2 text-sm text-slate-500">{attention.length} need attention · {pending.length} awaiting delivery</p>
    </section>
    <div className="my-6 flex flex-wrap gap-2" aria-label="Filter supplies">
      {(["all", "attention", "ordered"] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={filter === value ? "button-primary" : "button-secondary"}>{value === "all" ? "All supplies" : value === "attention" ? "Needs attention" : "Awaiting delivery"}</button>)}
    </div>
    <div className="space-y-4">
      {!visible.length && <p className="surface-card rounded-3xl p-8 text-slate-500">{typedItems.length ? "No supplies in this view." : "Add supplies on the Items page to get started."}</p>}
      {visible.map(item => {
        const vendor = vendors.find(v => v.id === item.vendorId) as VendorDoc | undefined;
        const location = locations.find(l => l.id === item.locationId);
        return <article key={item.id} className="surface-card rounded-3xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-xl font-semibold">{item.name}</h2><p className="mt-1 text-sm text-slate-500">{vendor?.name || "No vendor"} · {String(location?.name || "No location")}</p></div>
            <span className={`rounded-full px-3 py-1 text-sm ${item.orderStatus === "ordered" ? "bg-sky-100 text-sky-900" : needsReorder(item, now) ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{item.orderStatus === "ordered" ? "Awaiting delivery" : stockLabel(item, now)}</span>
          </div>
          {item.orderStatus === "ordered" ? <p className="mt-3 text-sm text-slate-500">Ordered {item.orderedAt?.toDate().toLocaleDateString()} by {item.orderedByName || "a teammate"}. Supply estimate: {stockLabel(item, now).toLowerCase()}.</p> : <div className="mt-4 flex flex-wrap gap-3">
            {vendor?.email && <a href={vendorEmail(vendor, item)} className="button-secondary !py-2 text-sm">Email vendor</a>}
            {vendor?.website && <a href={buildVendorSearchUrl(vendor, item.name) || "#"} target="_blank" rel="noopener noreferrer" className="button-secondary !py-2 text-sm">Search vendor site</a>}
            {!vendor?.email && !vendor?.website && <p className="text-sm text-slate-500">Add vendor contact details to reorder from here.</p>}
          </div>}
          <ItemActions item={item} />
        </article>;
      })}
    </div>
  </main>;
}
