"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import {
  doc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PLANS } from "@/lib/plans";

type ItemDoc = {
  id: string;
  name: string;
  vendorId?: string;
  daysLast: number;
  createdAt?: { toDate: () => Date } | null;
  createdByName?: string;
  description?: string;
  sku?: string;
};

type VendorDoc = {
  id: string;
  name: string;
};

type Unsubscribe = (() => void) | undefined;

export default function ItemsPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [plan, setPlan] = useState<keyof typeof PLANS>("basic");

  const [items, setItems] = useState<ItemDoc[]>([]);
  const [vendors, setVendors] = useState<VendorDoc[]>([]);

  // Add Vendor Modal
const [showVendorModal, setShowVendorModal] = useState(false);
const [newVendorName, setNewVendorName] = useState("");
const [vendorSaving, setVendorSaving] = useState(false);

  const [planLoaded, setPlanLoaded] = useState(false);
  const [itemsLoaded, setItemsLoaded] = useState(false);

  const loadingPage = !planLoaded || !itemsLoaded;

  // ---------- Add Modal ----------
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [daysLast, setDaysLast] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [description, setDescription] = useState(""); 
  const [sku, setSku] = useState(""); 

  // ---------- Edit Modal ----------
  const [showEdit, setShowEdit] = useState(false);
  const [editItem, setEditItem] = useState<ItemDoc | null>(null);

  // ---------- Delete ----------
  const [showDelete, setShowDelete] = useState(false);
  const [deleteItem, setDeleteItem] = useState<ItemDoc | null>(null);

  // =========================================
  // AUTH + ORG + DATA
  // =========================================
  useEffect(() => {
    let unsubOrg: Unsubscribe;
    let unsubItems: Unsubscribe;
    let unsubVendors: Unsubscribe;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push("/login");
        return;
      }

      setUser(u);

      unsubOrg = onSnapshot(doc(db, "users", u.uid), (userSnap) => {
        const org = userSnap.data()?.orgId;
        if (!org) return;

        setOrgId(org);

        // PLAN
        onSnapshot(doc(db, "organizations", org), (orgSnap) => {
          const rawPlan = orgSnap.data()?.plan;
          setPlan(
            rawPlan === "pro" ||
            rawPlan === "premium" ||
            rawPlan === "enterprise"
              ? rawPlan
              : "basic"
          );
          setPlanLoaded(true);
        });

        // VENDORS
        unsubVendors = onSnapshot(
          collection(db, "organizations", org, "vendors"),
          (snap) => {
            setVendors(
              snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<VendorDoc, "id">),
              }))
            );
          }
        );

        // ITEMS
        unsubItems = onSnapshot(
          collection(db, "organizations", org, "items"),
          (snap) => {
            setItems(
              snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<ItemDoc, "id">),
              }))
            );
            setItemsLoaded(true);
          }
        );
      });
    });

    return () => {
      unsubAuth();
      unsubOrg?.();
      unsubItems?.();
      unsubVendors?.();
    };
  }, [router]);

  // =========================================
  // HELPERS
  // =========================================
  function getStatus(item: ItemDoc) {
    if (!item.createdAt?.toDate) return null;

    const created = item.createdAt.toDate();
    const diffDays = Math.floor(
      (Date.now() - created.getTime()) / 86400000
    );
    const daysLeft = item.daysLast - diffDays;

    if (daysLeft <= 0)
      return { label: "Due Today", color: "bg-red-500", daysLeft: 0 };

    if (daysLeft <= 3)
      return { label: "Running Low", color: "bg-amber-500", daysLeft };

    return { label: "OK", color: "bg-green-500", daysLeft };
  }

  function getVendorName(item: ItemDoc) {
    const v = vendors.find((v) => v.id === item.vendorId);
    return v?.name || "—";
  }

  function getProgress(item: ItemDoc) {
    if (!item.createdAt?.toDate) return 0;

    const created = item.createdAt.toDate();
    const diffDays = Math.floor(
      (Date.now() - created.getTime()) / 86400000
    );
    const left = Math.max(item.daysLast - diffDays, 0);
    return Math.min(100, Math.max(0, (left / item.daysLast) * 100));
  }

  // =========================================
  // ACTIONS
  // =========================================
  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !orgId) return;

    await addDoc(collection(db, "organizations", orgId, "items"), {
      name,
      vendorId: vendorId || null,
      daysLast: Number(daysLast),
      description: description || "",
      sku: sku || "",
      createdAt: serverTimestamp(),
      createdByName: user.displayName || user.email,
    });

    setShowAdd(false);
    setName("");
    setDaysLast("");
    setVendorId("");
    setDescription("");
    setSku("");
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgId || !editItem) return;

    await updateDoc(
      doc(db, "organizations", orgId, "items", editItem.id),
      {
        name: editItem.name,
        vendorId: editItem.vendorId || null,
        daysLast: Number(editItem.daysLast),
        description: editItem.description || "",
        sku: editItem.sku || "", 
      }
    );

    setShowEdit(false);
    setEditItem(null);
  }

  async function handleCreateVendor(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  if (!orgId || !newVendorName.trim()) return;

  try {
    setVendorSaving(true);

    const ref = await addDoc(
      collection(db, "organizations", orgId, "vendors"),
      {
        name: newVendorName.trim(),
        createdAt: serverTimestamp(),
      }
    );

    // auto select it in the item modal
    setVendorId(ref.id);

    setShowVendorModal(false);
    setNewVendorName("");
  } finally {
    setVendorSaving(false);
  }
}

  async function handleDeleteConfirmed() {
    if (!orgId || !deleteItem) return;

    await deleteDoc(
      doc(db, "organizations", orgId, "items", deleteItem.id)
    );

    setShowDelete(false);
    setDeleteItem(null);
  }

  async function handleRefill(id: string) {
    if (!orgId) return;

    await updateDoc(
      doc(db, "organizations", orgId, "items", id),
      { createdAt: new Date() }
    );

    
  }

  // =========================================
  // PLAN LIMIT (BASIC = 5)
  // =========================================
  const planConfig = PLANS[plan];
  const itemLimit =
    plan === "basic"
      ? 5 
      : "limits" in planConfig
      ? planConfig.limits.items
      : Infinity;

  const atLimit = itemLimit !== Infinity && items.length >= itemLimit;

  // =========================================
  // LOADING
  // =========================================
  if (loadingPage) {
    return (
      <motion.main
        className="p-4 md:p-10 flex-1 flex items-center justify-center"
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-slate-300 border-t-sky-500 animate-spin" />
          <p className="text-sm text-slate-500">
            Loading your items…
          </p>
        </div>
      </motion.main>
    );
  }

  // =========================================
  // UI
  // =========================================
  return (
    <motion.main className="p-4 md:p-10 flex-1">
      <h1 className="text-3xl font-bold">Items</h1>

      <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <strong>{items.length}</strong> /{" "}
          {itemLimit === Infinity ? "∞" : itemLimit} items used
        </p>

        <span className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700">
          {PLANS[plan].name} Plan
        </span>
      </div>

      {atLimit && (
        <div className="mt-4 p-4 bg-amber-100 dark:bg-amber-900 text-sm rounded">
          You’ve reached your plan limit.
        </div>
      )}

      <div className="mt-6 flex justify-between items-center">
        <h2 className="text-xl font-semibold">Your Items</h2>

        <button
          onClick={() => !atLimit && setShowAdd(true)}
          disabled={atLimit}
          className={`px-4 py-2 rounded-lg text-white ${
            atLimit ? "bg-gray-400" : "bg-sky-600 hover:bg-sky-700"
          }`}
        >
          + Add Item
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {items.length === 0 && (
          <div className="p-10 border border-dashed rounded-xl text-center text-slate-500">
            No items yet.
          </div>
        )}

        {items.map((item) => {
          const status = getStatus(item);
          return (
            <div
                key={item.id}
                className="p-4 border rounded-xl bg-white dark:bg-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center"
              >
                <div className="flex-1 pr-0 md:pr-4">
                <h3 className="font-semibold">{item.name}</h3>

                {status && (
                  <span
                    className={`mt-1 inline-block px-2 py-1 text-xs rounded text-white ${status.color}`}
                  >
                    {status.label} • {status.daysLeft} days left
                  </span>
                )}

                <div className="mt-3 h-2 bg-slate-300 rounded">
                  <div
                    className="h-full rounded bg-sky-600"
                    style={{ width: `${getProgress(item)}%` }}
                  />
                </div>

                <p className="text-sm mt-2">
                  Vendor: {getVendorName(item)}
                </p>

                {item.description && (
                  <p className="text-sm text-slate-600 mt-1">
                    Notes: {item.description}
                  </p>
                )}

                <p className="text-xs text-slate-500 mt-1">
                  Added by {item.createdByName || "Unknown"}
                </p>
              </div>

              <div className="flex gap-2 mt-3 md:mt-0 flex-shrink-0">
                <button
                  onClick={() => handleRefill(item.id)}
                  className="w-full md:w-auto px-3 py-1.5 bg-green-500 text-white rounded"
                >
                  Refill
                </button>

                <button
                  onClick={() => {
                    setEditItem(item);
                    setShowEdit(true);
                  }}
                  className="w-full md:w-auto px-3 py-1.5 bg-blue-500 text-white rounded"
                >
                  Edit
                </button>

                <button
                  onClick={() => {
                    setDeleteItem(item);
                    setShowDelete(true);
                  }}
                  className="w-full md:w-auto px-3 py-1.5 bg-red-500 text-white rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================= ADD MODAL ========================= */}
      <AnimatePresence>
  {showAdd && (
    <motion.div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => setShowAdd(false)}   // <<< CLICK OUTSIDE CLOSES
    >
      <motion.form
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2 }}
        onSubmit={handleAdd}
        onClick={(e) => e.stopPropagation()}   // <<< PREVENT CLOSE ON FORM CLICK
        className="bg-white dark:bg-slate-800 p-6 rounded-xl w-full max-w-md space-y-4"
      >
              <h2 className="text-xl font-semibold">Add Item</h2>

<div>
  <label className="block text-sm font-medium mb-1">
    Item Name
  </label>
  <input
    className="input"
    placeholder="Paper Towels, Coffee, Printer Ink…"
    value={name}
    onChange={(e) => setName(e.target.value)}
    required
  />
</div>

<div>
  <label className="block text-sm font-medium mb-1">
    Reorder Reminder (days)
  </label>
  <input
    className="input"
    type="number"
    placeholder="How many days does this usually last?"
    value={daysLast}
    onChange={(e) => setDaysLast(e.target.value)}
    required
  />
</div>

<div>
  <label className="block text-sm font-medium mb-1">
    Description / Notes (optional)
  </label>
  <textarea
    className="input"
    placeholder="Example: Bathroom paper towels for downstairs restrooms"
    value={description}
    onChange={(e) => setDescription(e.target.value)}
  />
</div>

<div>
  <label className="block text-sm font-medium mb-1">
    SKU / Item #
  </label>
  <input
    className="input"
    placeholder="Optional item or vendor SKU"
    value={sku}
    onChange={(e) => setSku(e.target.value)}
  />
</div>

<div>
  <label className="block text-sm font-medium mb-1">
    Supplier
  </label>

  <div className="flex gap-2">
    <select
      className="input flex-1"
      value={vendorId}
      onChange={(e) => setVendorId(e.target.value)}
    >
      <option value="">Select supplier</option>
      {vendors.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      ))}
    </select>

    <button
      type="button"
      onClick={() => setShowVendorModal(true)}
      className="px-3 rounded-lg border bg-slate-100 hover:bg-slate-200"
    >
      + Add
    </button>
  </div>
</div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="w-1/2 border p-3 rounded"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="w-1/2 bg-sky-600 text-white p-3 rounded"
                >
                  Save
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================= EDIT MODAL ========================= */}
      <AnimatePresence>
        {showEdit && editItem && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowEdit(false)}
          >
            <motion.form
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleEdit}
              className="bg-white dark:bg-slate-800 p-6 rounded-xl w-full max-w-md space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-semibold">Edit Item</h2>

<div>
  <label className="block text-sm font-medium mb-1">
    Item Name
  </label>
  <input
    className="input"
    value={editItem.name}
    onChange={(e) =>
      setEditItem({ ...editItem, name: e.target.value })
    }
  />
</div>

<div>
  <label className="block text-sm font-medium mb-1">
    Reorder Reminder (days)
  </label>
  <input
    className="input"
    type="number"
    value={editItem.daysLast}
    onChange={(e) =>
      setEditItem({
        ...editItem,
        daysLast: Number(e.target.value),
      })
    }
  />
</div>

<div>
  <label className="block text-sm font-medium mb-1">
    Description / Notes (optional)
  </label>
  <textarea
    className="input"
    placeholder="Optional details about this item"
    value={editItem.description || ""}
    onChange={(e) =>
      setEditItem({
        ...editItem,
        description: e.target.value,
      })
    }
  />
</div>

<div>
  <label className="block text-sm font-medium mb-1">
    SKU / Item #
  </label>
  <input
    className="input"
    placeholder="Optional item or vendor SKU"
    value={sku}
    onChange={(e) => setSku(e.target.value)}
  />
</div>

<div>
  <label className="block text-sm font-medium mb-1">
    Supplier
  </label>

  <div className="flex gap-2">
    <select
      className="input flex-1"
      value={editItem.vendorId || ""}
      onChange={(e) =>
        setEditItem({ ...editItem!, vendorId: e.target.value })
      }
    >
      <option value="">Select supplier</option>
      {vendors.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      ))}
    </select>

    <button
      type="button"
      onClick={() => setShowVendorModal(true)}
      className="px-3 rounded-lg border bg-slate-100 hover:bg-slate-200"
    >
      + Add
    </button>
  </div>
</div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="w-1/2 border p-3 rounded"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="w-1/2 bg-blue-600 text-white p-3 rounded"
                >
                  Save
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================= DELETE MODAL ========================= */}
      <AnimatePresence>
        {showDelete && deleteItem && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDelete(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-800 p-6 rounded-xl w-full max-w-sm space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold">Delete item?</h2>

              <p>
                Are you sure you want to delete{" "}
                <strong>{deleteItem.name}</strong>? This cannot be undone.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowDelete(false)}
                  className="w-1/2 border p-3 rounded"
                >
                  Cancel
                </button>

                <button
                  onClick={handleDeleteConfirmed}
                  className="w-1/2 bg-red-600 text-white p-3 rounded"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
{showVendorModal && (
  <motion.div
    className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={() => setShowVendorModal(false)}
  >
    <motion.form
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.2 }}
      onSubmit={handleCreateVendor}
      onClick={(e) => e.stopPropagation()}
      className="bg-white dark:bg-slate-800 p-6 rounded-xl w-full max-w-md space-y-4"
    >
      <h2 className="text-xl font-semibold">
        Add Supplier
      </h2>

      <div>
        <label className="block text-sm font-medium mb-1">
          Supplier Name
        </label>
        <input
          className="input"
          value={newVendorName}
          onChange={(e) => setNewVendorName(e.target.value)}
          required
          placeholder="Example: Staples, Amazon, Local Vendor"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShowVendorModal(false)}
          className="w-1/2 border p-3 rounded"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={vendorSaving}
          className="w-1/2 bg-sky-600 text-white p-3 rounded"
        >
          {vendorSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </motion.form>
  </motion.div>
)}
</AnimatePresence>
    </motion.main>
  );
}
