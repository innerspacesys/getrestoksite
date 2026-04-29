"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { PLANS } from "@/lib/plans";

type TimestampLike = {
  toDate: () => Date;
};

type ItemDoc = {
  id: string;
  name: string;
  vendorId?: string | null;
  locationId?: string | null;
  daysLast: number;
  createdAt?: TimestampLike | null;
  createdByName?: string;
  description?: string;
  sku?: string;
};

type VendorDoc = {
  id: string;
  name: string;
};

type LocationDoc = {
  id: string;
  name: string;
};

type ItemFormState = {
  name: string;
  daysLast: string;
  vendorId: string;
  locationId: string;
  description: string;
  sku: string;
};

type Unsubscribe = (() => void) | undefined;

const EMPTY_FORM: ItemFormState = {
  name: "",
  daysLast: "",
  vendorId: "",
  locationId: "",
  description: "",
  sku: "",
};

export default function ItemsPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [plan, setPlan] = useState<keyof typeof PLANS>("basic");

  const [items, setItems] = useState<ItemDoc[]>([]);
  const [vendors, setVendors] = useState<VendorDoc[]>([]);
  const [locations, setLocations] = useState<LocationDoc[]>([]);

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);

  const [form, setForm] = useState<ItemFormState>(EMPTY_FORM);
  const [editItem, setEditItem] = useState<ItemDoc | null>(null);
  const [deleteItem, setDeleteItem] = useState<ItemDoc | null>(null);
  const [newVendorName, setNewVendorName] = useState("");
  const [vendorSaving, setVendorSaving] = useState(false);

  const [planLoaded, setPlanLoaded] = useState(false);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [locationsLoaded, setLocationsLoaded] = useState(false);

  const loadingPage = !planLoaded || !itemsLoaded || !locationsLoaded;

  useEffect(() => {
    let unsubOrg: Unsubscribe;
    let unsubItems: Unsubscribe;
    let unsubVendors: Unsubscribe;
    let unsubLocations: Unsubscribe;

    const unsubAuth = onAuthStateChanged(auth, (nextUser) => {
      if (!nextUser) {
        router.push("/login");
        return;
      }

      setUser(nextUser);

      onSnapshot(doc(db, "users", nextUser.uid), (userSnap) => {
        const currentOrgId = userSnap.data()?.orgId as string | undefined;
        if (!currentOrgId) return;

        setOrgId(currentOrgId);

        unsubOrg?.();
        unsubOrg = onSnapshot(doc(db, "organizations", currentOrgId), (orgSnap) => {
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

        unsubVendors?.();
        unsubVendors = onSnapshot(
          collection(db, "organizations", currentOrgId, "vendors"),
          (snap) => {
            setVendors(
              snap.docs.map((entry) => ({
                id: entry.id,
                ...(entry.data() as Omit<VendorDoc, "id">),
              }))
            );
          }
        );

        unsubLocations?.();
        unsubLocations = onSnapshot(
          collection(db, "organizations", currentOrgId, "locations"),
          (snap) => {
            setLocations(
              snap.docs.map((entry) => ({
                id: entry.id,
                ...(entry.data() as Omit<LocationDoc, "id">),
              }))
            );
            setLocationsLoaded(true);
          }
        );

        unsubItems?.();
        unsubItems = onSnapshot(
          collection(db, "organizations", currentOrgId, "items"),
          (snap) => {
            setItems(
              snap.docs.map((entry) => ({
                id: entry.id,
                ...(entry.data() as Omit<ItemDoc, "id">),
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
      unsubLocations?.();
    };
  }, [router]);

  function getStatus(item: ItemDoc) {
    if (!item.createdAt?.toDate) return null;

    const created = item.createdAt.toDate();
    const diffDays = Math.floor((Date.now() - created.getTime()) / 86400000);
    const daysLeft = item.daysLast - diffDays;

    if (daysLeft <= 0) {
      return { label: "Due Today", color: "bg-red-500", daysLeft: 0 };
    }

    if (daysLeft <= 3) {
      return { label: "Running Low", color: "bg-amber-500", daysLeft };
    }

    return { label: "OK", color: "bg-green-500", daysLeft };
  }

  function getProgress(item: ItemDoc) {
    if (!item.createdAt?.toDate) return 0;

    const created = item.createdAt.toDate();
    const diffDays = Math.floor((Date.now() - created.getTime()) / 86400000);
    const left = Math.max(item.daysLast - diffDays, 0);
    return Math.min(100, Math.max(0, (left / item.daysLast) * 100));
  }

  function getVendorName(item: ItemDoc) {
    return vendors.find((vendor) => vendor.id === item.vendorId)?.name || "—";
  }

  function getLocationName(item: ItemDoc) {
    return (
      locations.find((location) => location.id === item.locationId)?.name || "—"
    );
  }

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function openEditModal(item: ItemDoc) {
    setEditItem(item);
    setForm({
      name: item.name,
      daysLast: String(item.daysLast),
      vendorId: item.vendorId || "",
      locationId: item.locationId || "",
      description: item.description || "",
      sku: item.sku || "",
    });
    setShowEdit(true);
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !orgId) return;

    await addDoc(collection(db, "organizations", orgId, "items"), {
      name: form.name.trim(),
      vendorId: form.vendorId || null,
      locationId: form.locationId || null,
      daysLast: Number(form.daysLast),
      description: form.description.trim() || "",
      sku: form.sku.trim() || "",
      createdAt: serverTimestamp(),
      createdByName: user.displayName || user.email,
    });

    setShowAdd(false);
    resetForm();
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgId || !editItem) return;

    await updateDoc(doc(db, "organizations", orgId, "items", editItem.id), {
      name: form.name.trim(),
      vendorId: form.vendorId || null,
      locationId: form.locationId || null,
      daysLast: Number(form.daysLast),
      description: form.description.trim() || "",
      sku: form.sku.trim() || "",
    });

    setShowEdit(false);
    setEditItem(null);
    resetForm();
  }

  async function handleDeleteConfirmed() {
    if (!orgId || !deleteItem) return;

    await deleteDoc(doc(db, "organizations", orgId, "items", deleteItem.id));
    setShowDelete(false);
    setDeleteItem(null);
  }

  async function handleRefill(id: string) {
    if (!orgId) return;

    await updateDoc(doc(db, "organizations", orgId, "items", id), {
      createdAt: new Date(),
    });
  }

  async function handleCreateVendor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgId || !newVendorName.trim()) return;

    try {
      setVendorSaving(true);

      const ref = await addDoc(collection(db, "organizations", orgId, "vendors"), {
        name: newVendorName.trim(),
        createdAt: serverTimestamp(),
      });

      setForm((current) => ({ ...current, vendorId: ref.id }));
      setShowVendorModal(false);
      setNewVendorName("");
    } finally {
      setVendorSaving(false);
    }
  }

  const planConfig = PLANS[plan];
  const itemLimit =
    plan === "basic"
      ? 5
      : "limits" in planConfig
        ? planConfig.limits.items
        : Infinity;
  const atLimit = itemLimit !== Infinity && items.length >= itemLimit;

  if (loadingPage) {
    return (
      <motion.main
        className="flex flex-1 items-center justify-center p-4 md:p-10"
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-sky-500" />
          <p className="text-sm text-slate-500">Loading your items…</p>
        </div>
      </motion.main>
    );
  }

  return (
    <motion.main
      className="mx-auto flex-1 max-w-6xl p-4 md:p-10"
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
    >
      <section className="surface-panel rounded-[32px] px-6 py-7 md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="eyebrow">Item Tracking</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 md:text-4xl">
              Items
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
              Track what you reorder, where it belongs, and how long it lasts.
              You can set up vendors first or add a supplier while creating an
              item.
            </p>
          </div>

          <div className="rounded-3xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100 lg:min-w-[240px]">
            <div className="font-semibold">Current usage</div>
            <div className="mt-1">
              <strong>{items.length}</strong> / {itemLimit === Infinity ? "∞" : itemLimit} items
            </div>
            <div className="mt-2 inline-flex rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-800 dark:bg-sky-950/50 dark:text-sky-100">
              {PLANS[plan].name} Plan
            </div>
          </div>
        </div>
      </section>

      {atLimit && (
        <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          You’ve reached the item limit for your current plan.
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Your Items</h2>
        <button
          onClick={() => {
            if (atLimit) return;
            resetForm();
            setShowAdd(true);
          }}
          disabled={atLimit}
          className={`rounded-2xl px-4 py-2.5 font-medium text-white ${
            atLimit ? "bg-gray-400" : "bg-sky-600 hover:bg-sky-700"
          }`}
        >
          + Add Item
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {items.length === 0 && (
          <div className="rounded-[28px] border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No items yet.
          </div>
        )}

        {items.map((item) => {
          const status = getStatus(item);
          return (
            <div
              key={item.id}
              className="surface-card flex flex-col gap-4 rounded-[28px] p-5 md:flex-row md:items-start md:justify-between"
            >
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {item.name}
                </h3>

                {status && (
                  <span
                    className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold text-white ${status.color}`}
                  >
                    {status.label} • {status.daysLeft} days left
                  </span>
                )}

                <div className="mt-4 h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-sky-600"
                    style={{ width: `${getProgress(item)}%` }}
                  />
                </div>

                <div className="mt-4 grid gap-2 text-sm text-slate-700 dark:text-slate-300 md:grid-cols-2">
                  <p>Vendor: {getVendorName(item)}</p>
                  <p>Location: {getLocationName(item)}</p>
                </div>

                {item.description && (
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                    Notes: {item.description}
                  </p>
                )}

                {item.sku && (
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    SKU: {item.sku}
                  </p>
                )}

                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Added by {item.createdByName || "Unknown"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 md:max-w-[220px] md:flex-col">
                <button
                  onClick={() => handleRefill(item.id)}
                  className="rounded-2xl bg-green-500 px-4 py-2 text-white"
                >
                  Refill
                </button>
                <button
                  onClick={() => openEditModal(item)}
                  className="rounded-2xl bg-blue-500 px-4 py-2 text-white"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setDeleteItem(item);
                    setShowDelete(true);
                  }}
                  className="rounded-2xl bg-red-500 px-4 py-2 text-white"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {showAdd && (
          <ItemModal
            title="Add Item"
            submitLabel="Save"
            form={form}
            setForm={setForm}
            vendors={vendors}
            locations={locations}
            onClose={() => setShowAdd(false)}
            onSubmit={handleAdd}
            onAddVendor={() => setShowVendorModal(true)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEdit && editItem && (
          <ItemModal
            title="Edit Item"
            submitLabel="Save Changes"
            form={form}
            setForm={setForm}
            vendors={vendors}
            locations={locations}
            onClose={() => {
              setShowEdit(false);
              setEditItem(null);
              resetForm();
            }}
            onSubmit={handleEdit}
            onAddVendor={() => setShowVendorModal(true)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDelete && deleteItem && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
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
              onClick={(e) => e.stopPropagation()}
              className="mx-4 w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl dark:bg-slate-800"
            >
              <h2 className="text-lg font-semibold">Delete item?</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Are you sure you want to delete <strong>{deleteItem.name}</strong>?
                This cannot be undone.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setShowDelete(false)}
                  className="w-1/2 rounded-2xl border p-3"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirmed}
                  className="w-1/2 rounded-2xl bg-red-600 p-3 text-white"
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
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
              className="mx-4 w-full max-w-md space-y-4 rounded-[28px] bg-white p-6 shadow-2xl dark:bg-slate-800"
            >
              <h2 className="text-xl font-semibold">Add Supplier</h2>
              <div>
                <label className="mb-1 block text-sm font-medium">Supplier Name</label>
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
                  className="w-1/2 rounded-2xl border p-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={vendorSaving}
                  className="w-1/2 rounded-2xl bg-sky-600 p-3 text-white"
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

function ItemModal({
  title,
  submitLabel,
  form,
  setForm,
  vendors,
  locations,
  onClose,
  onSubmit,
  onAddVendor,
}: {
  title: string;
  submitLabel: string;
  form: ItemFormState;
  setForm: React.Dispatch<React.SetStateAction<ItemFormState>>;
  vendors: VendorDoc[];
  locations: LocationDoc[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onAddVendor: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.form
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2 }}
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="mx-4 w-full max-w-md space-y-4 rounded-[28px] bg-white p-6 shadow-2xl dark:bg-slate-800"
      >
        <h2 className="text-xl font-semibold">{title}</h2>

        <div>
          <label className="mb-1 block text-sm font-medium">Item Name</label>
          <input
            className="input"
            placeholder="Paper Towels, Coffee, Printer Ink…"
            value={form.name}
            onChange={(e) =>
              setForm((current) => ({ ...current, name: e.target.value }))
            }
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Reorder Reminder (days)
          </label>
          <input
            className="input"
            type="number"
            min="1"
            placeholder="How many days does this usually last?"
            value={form.daysLast}
            onChange={(e) =>
              setForm((current) => ({ ...current, daysLast: e.target.value }))
            }
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Description / Notes
          </label>
          <textarea
            className="input min-h-[120px]"
            placeholder="Optional details about this item"
            value={form.description}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                description: e.target.value,
              }))
            }
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">SKU / Item #</label>
          <input
            className="input"
            placeholder="Optional item or vendor SKU"
            value={form.sku}
            onChange={(e) =>
              setForm((current) => ({ ...current, sku: e.target.value }))
            }
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Supplier</label>
          <div className="flex gap-2">
            <select
              className="input flex-1"
              value={form.vendorId}
              onChange={(e) =>
                setForm((current) => ({ ...current, vendorId: e.target.value }))
              }
            >
              <option value="">Select supplier</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onAddVendor}
              className="rounded-2xl border bg-slate-100 px-3 dark:bg-slate-700"
            >
              + Add
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Location / Department
          </label>
          <select
            className="input"
            value={form.locationId}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                locationId: e.target.value,
              }))
            }
          >
            <option value="">No location assigned</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-1/2 rounded-2xl border p-3"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="w-1/2 rounded-2xl bg-sky-600 p-3 text-white"
          >
            {submitLabel}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
