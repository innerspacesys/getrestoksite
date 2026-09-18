"use client";

import { useState } from "react";
import Link from "next/link";
import { needsReorder, daysRemaining, stockLabel, type StockItem } from "@/lib/inventory";
import { db } from "@/lib/data/client";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "@/lib/data/client";
import { motion, Variants } from "framer-motion";
import { useOrgData } from "@/lib/useOrgData";

type VendorDoc = {
  id: string;
  name: string;
  email?: string | null;
  website?: string | null;
  hasPhysicalStore?: boolean;
};

export default function VendorsPage() {
  const { orgId, vendors, items, loading } = useOrgData();

  const [search, setSearch] = useState("");
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const directory = vendors.map(vendor => {
    const linked = items.filter(item => item.vendorId === vendor.id);
    return { vendor: vendor as VendorDoc, linked, due: linked.filter(item => needsReorder(item as StockItem)).length };
  }).sort((a,b) => b.due - a.due || a.vendor.name.localeCompare(b.vendor.name));
  const matches = directory.filter(({vendor}) => `${vendor.name} ${vendor.email || ""} ${vendor.website || ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  function websiteUrl(value?: string | null) {
    if (!value) return null;
    try { const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`); return ["https:","http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
  }

  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorDoc | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [hasStore, setHasStore] = useState(false);

  const [deleteVendor, setDeleteVendor] = useState<VendorDoc | null>(null);

  const modalBackdrop: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalPanel: Variants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: "spring", stiffness: 220, damping: 18 },
    },
    exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.15 } },
  };

  // -------------------------
  // SAVE VENDOR
  // -------------------------
  async function handleSaveVendor(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || saving) return;
    if (!name.trim()) { setSaveError("Enter a vendor name."); return; }
    if (website.trim() && !websiteUrl(website.trim())) { setSaveError("Enter a valid website address."); return; }
    setSaving(true); setSaveError("");

    const payload = {
      name: name.trim(),
      email: email.trim() || null,
      website: websiteUrl(website.trim()),
      hasPhysicalStore: hasStore,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingVendor) {
        await updateDoc(
          doc(db, "organizations", orgId, "vendors", editingVendor.id),
          payload
        );
      } else {
        await addDoc(collection(db, "organizations", orgId, "vendors"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      resetModal();
    } catch (err) {
      console.error("Failed to save vendor:", err);
      setSaveError("Unable to save this vendor. Please try again.");
    } finally { setSaving(false); }
  }

  function resetModal() {
    setShowModal(false);
    setEditingVendor(null);
    setName("");
    setEmail("");
    setWebsite("");
    setHasStore(false);
    setSaveError("");
  }

  // -------------------------
  // DELETE VENDOR SAFELY
  // -------------------------
  async function handleDeleteVendor(vendor: VendorDoc) {
    if (!orgId) return;

    const itemsSnap = await getDocs(
      query(
        collection(db, "organizations", orgId, "items"),
        where("vendorId", "==", vendor.id)
      )
    );

    if (!itemsSnap.empty) {
      alert("This vendor is currently used by one or more items.");
      return;
    }

    await deleteDoc(doc(db, "organizations", orgId, "vendors", vendor.id));
    setDeleteVendor(null);
  }

  // -------------------------
  // LOADING
  // -------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-14 w-14 border-4 border-sky-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // -------------------------
  // UI
  // -------------------------
  return (
    <motion.main
      className="mx-auto flex-1 max-w-6xl p-4 md:p-10"
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
    >
      <section className="surface-panel rounded-[32px] px-6 py-7 md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="eyebrow">Supplier Directory</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 md:text-4xl">
              Vendors
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
              Keep the suppliers you reorder from in one place so items,
              restock actions, and reports have the right contact details.
            </p>
          </div>

          <div className="rounded-3xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100 lg:min-w-[240px]">
            <div className="font-semibold">Vendor count</div>
            <div className="mt-1">
              <strong>{vendors.length}</strong> supplier{vendors.length === 1 ? "" : "s"}
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="button-primary mt-3 w-full !rounded-2xl !px-4 !py-2.5 text-sm shadow-none"
            >
              + Add Vendor
            </button>
          </div>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[{label:"Vendors",value:vendors.length},{label:"Linked supplies",value:items.filter(item => item.vendorId).length},{label:"Need reordering",value:directory.reduce((sum,row) => sum + row.due,0)}].map(stat => <div key={stat.label} className="surface-panel rounded-2xl p-4"><p className="text-2xl font-semibold">{stat.value}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{stat.label}</p></div>)}
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Your supplier directory</h2>
        <input type="search" aria-label="Search vendors" placeholder="Search name, email, or website…" value={search} onChange={event => setSearch(event.target.value)} className="input sm:!w-80" />
      </div>
      <div className="mt-4 space-y-4">
        {!matches.length && <div className="surface-panel rounded-3xl border-dashed p-10 text-center"><h3 className="font-semibold">{vendors.length ? "No matching vendors" : "Start with your go-to supplier"}</h3><p className="mt-2 text-sm text-slate-500">{vendors.length ? "Try another name, email, or website." : "Add a vendor, then link it to supplies from the Items page."}</p>{!vendors.length && <button onClick={() => setShowModal(true)} className="button-primary mt-5">Add your first vendor</button>}</div>}
        {matches.map(({vendor:v,linked,due}) => {
          const expanded = expandedVendor === v.id;
          const url = websiteUrl(v.website);
          const sorted = [...linked].sort((a,b) => Number(needsReorder(b as StockItem))-Number(needsReorder(a as StockItem)) || (daysRemaining(a as StockItem) ?? Infinity)-(daysRemaining(b as StockItem) ?? Infinity));
          return <section key={v.id} className="surface-panel overflow-hidden rounded-3xl">
            <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-6">
              <div className="flex min-w-0 items-start gap-4">
                <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-lg font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-200">{v.name.slice(0,2).toUpperCase()}</div>
                <div className="min-w-0"><h3 className="text-lg font-semibold"><button onClick={() => setExpandedVendor(expanded ? null : v.id)} aria-expanded={expanded} aria-controls={`vendor-${v.id}`} className="text-left hover:text-sky-600">{v.name}</button></h3>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                    {v.email && <a className="break-all hover:underline" href={`mailto:${v.email}`}>{v.email}</a>}
                    {url && <a className="break-all text-sky-600 hover:underline dark:text-sky-300" href={url} target="_blank" rel="noopener noreferrer">Visit website ↗</a>}
                    {!v.email && !url && <span>No contact details yet</span>}
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{linked.length} linked {linked.length === 1 ? "supply" : "supplies"}{v.hasPhysicalStore ? " · Store pickup available" : ""}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {due > 0 && <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">{due} to reorder</span>}
                <button aria-expanded={expanded} aria-controls={`vendor-${v.id}`} onClick={() => setExpandedVendor(expanded ? null : v.id)} className="button-primary !px-4 !py-2 text-sm">{expanded ? "Hide supplies" : "View supplies"}</button>
                <button aria-label={`Edit ${v.name}`} onClick={() => {setEditingVendor(v);setName(v.name);setEmail(v.email || "");setWebsite(v.website || "");setHasStore(v.hasPhysicalStore || false);setSaveError("");setShowModal(true);}} className="button-secondary !px-3 !py-2 text-sm">Edit</button>
                <button aria-label={`Delete ${v.name}`} onClick={() => setDeleteVendor(v)} className="rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950">Delete</button>
              </div>
            </div>
            {expanded && <div id={`vendor-${v.id}`} className="border-t border-slate-200/70 bg-slate-50/60 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/30 md:px-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">Supplies from {v.name}</h4><Link className="text-sm text-sky-600 hover:underline dark:text-sky-300" href="/dashboard/restock">Open restock queue →</Link></div>
              {!sorted.length ? <p className="py-3 text-sm text-slate-500">No supplies linked yet. <Link href="/dashboard/items" className="text-sky-600 underline">Choose this vendor when adding or editing an item.</Link></p> : <ul className="divide-y divide-slate-200 dark:divide-slate-800">{sorted.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><Link href="/dashboard/items" className="font-medium hover:text-sky-600">{String(item.name || "Untitled supply")}</Link><span className={`text-sm ${needsReorder(item as StockItem) ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"}`}>{item.orderStatus === "ordered" ? "Ordered · awaiting delivery" : stockLabel(item as StockItem)}</span></li>)}</ul>}
            </div>}
          </section>;
        })}
      </div>

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <motion.div
          className="fixed inset-0 bg-black/40 p-4 flex items-center justify-center z-50"
          variants={modalBackdrop}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={resetModal}
        >
          <motion.form
            onSubmit={handleSaveVendor}
            variants={modalPanel}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="bg-white dark:bg-slate-800 p-6 rounded-xl w-full max-w-md space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold">
              {editingVendor ? "Edit Vendor" : "Add Vendor"}
            </h2>

            <input
              required
              className="input"
              aria-label="Vendor name"
              placeholder="Vendor name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              className="input"
              type="email"
              aria-label="Vendor email"
              placeholder="Vendor email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              className="input"
              aria-label="Vendor website"
              placeholder="Vendor website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasStore}
                onChange={(e) => setHasStore(e.target.checked)}
              />
              This vendor has a physical store location
            </label>

            {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={resetModal}
                className="w-1/2 border p-3 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>

              <button
                disabled={saving}
                type="submit"
                className="w-1/2 bg-sky-600 hover:bg-sky-700 text-white p-3 rounded transition"
              >
                {saving ? "Saving…" : "Save vendor"}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}

      {/* DELETE CONFIRM */}
      {deleteVendor && (
        <motion.div
          className="fixed inset-0 bg-black/50 p-4 flex items-center justify-center z-50"
          variants={modalBackdrop}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={() => setDeleteVendor(null)}
        >
          <motion.div
            variants={modalPanel}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="bg-white dark:bg-slate-800 p-6 rounded-xl w-full max-w-sm space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Delete vendor?</h2>

            <p className="text-sm text-slate-600 dark:text-slate-400">
              Are you sure you want to delete{" "}
              <strong>{deleteVendor.name}</strong>? This cannot be undone.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setDeleteVendor(null)}
                className="w-1/2 border p-3 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>

              <button
                onClick={() => handleDeleteVendor(deleteVendor)}
                className="w-1/2 bg-red-600 hover:bg-red-700 text-white p-3 rounded transition"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.main>
  );
}
