"use client";

import { useState } from "react";
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
import { motion, AnimatePresence } from "framer-motion";
import { softSpring } from "@/lib/motion";
import { useOrgData } from "@/lib/useOrgData";
import { PLANS } from "@/lib/plans";

type LocationDoc = {
  id: string;
  name: string;
  isDepartment?: boolean;
  address?: string | null;
  description?: string | null;
};

export default function LocationsPage() {
  const { orgId, plan, locations, loading } = useOrgData();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LocationDoc | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [isDepartment, setIsDepartment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<LocationDoc | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgId || saving) return;
    if (!name.trim()) {
      setSaveError("Enter a name for this location.");
      return;
    }

    setSaving(true);
    setSaveError("");

    const payload = {
      name: name.trim(),
      address: address.trim() || null,
      description: description.trim() || null,
      isDepartment,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editing) {
        await updateDoc(doc(db, "organizations", orgId, "locations", editing.id), payload);
      } else {
        await addDoc(collection(db, "organizations", orgId, "locations"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
      resetModal();
    } catch {
      setSaveError("Unable to save this location. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function resetModal() {
    setShowModal(false);
    setEditing(null);
    setName("");
    setAddress("");
    setDescription("");
    setIsDepartment(false);
    setSaveError("");
  }

  async function handleDelete(loc: LocationDoc) {
    if (!orgId || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const itemsSnap = await getDocs(
        query(
          collection(db, "organizations", orgId, "items"),
          where("locationId", "==", loc.id)
        )
      );

      if (!itemsSnap.empty) {
        setDeleteError("This location is still assigned to one or more items. Reassign them first.");
        return;
      }

      await deleteDoc(doc(db, "organizations", orgId, "locations", loc.id));
      setDeleteTarget(null);
    } catch {
      setDeleteError("Unable to delete this location. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
      </div>
    );
  }

  const planKey =
    plan === "pro" || plan === "premium" || plan === "enterprise" ? plan : "basic";
  const planConfig = PLANS[planKey];
  const locationLimit = "limits" in planConfig ? planConfig.limits.locations : Infinity;
  const atLimit = locationLimit !== Infinity && locations.length >= locationLimit;

  return (
    <motion.main
      className="mx-auto max-w-6xl flex-1 p-4 md:p-10"
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
    >
      <section className="surface-panel rounded-[32px] px-6 py-7 md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="eyebrow">Organization Map</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 md:text-4xl">
              Locations
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
              Locations can represent departments like Accounting or Warehouse, or physical
              places like a main office or storage closet. Use them however your operation
              thinks about space.
            </p>
          </div>

          <div className="rounded-3xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100 lg:min-w-[240px]">
            <div className="font-semibold">Current usage</div>
            <div className="mt-1">
              <strong>{locations.length}</strong> / {locationLimit === Infinity ? "∞" : locationLimit} locations
            </div>
            <div className="mt-2 inline-flex rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-800 dark:bg-sky-950/50 dark:text-sky-100">
              {planConfig.name} Plan
            </div>
          </div>
        </div>
      </section>

      {atLimit && locationLimit !== Infinity && (
        <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <strong>Want to add more locations?</strong>
          <p className="mt-1 text-amber-800 dark:text-amber-200/90">
            Your {planConfig.name} plan includes {locationLimit} location
            {locationLimit === 1 ? "" : "s"}. Upgrade for more.
          </p>
          <button
            onClick={() => (window.location.href = "/dashboard/settings#billing")}
            className="button-primary mt-3 !py-2 text-sm"
          >
            Upgrade plan
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Your locations</h2>
        <button
          onClick={() => {
            if (atLimit) return;
            setShowModal(true);
          }}
          disabled={atLimit}
          className={`rounded-2xl px-4 py-2.5 font-medium text-white ${
            atLimit ? "bg-gray-400" : "bg-sky-600 hover:bg-sky-700"
          }`}
        >
          + Add Location
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {locations.length === 0 && (
          <div className="rounded-[28px] border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">No locations yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Add a room, department, or storage spot so alerts, reports, and restock reviews
              are easier to organize.
            </p>
            <button onClick={() => setShowModal(true)} className="mt-5 rounded-2xl bg-sky-600 px-5 py-2.5 font-medium text-white hover:bg-sky-700">
              + Add Location
            </button>
          </div>
        )}

        {locations.map((location, i) => {
          const l = location as LocationDoc;
          return (
            <motion.div
              key={l.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...softSpring, delay: Math.min(i, 4) * 0.045 }}
              className="surface-card flex flex-col items-start justify-between gap-4 rounded-[28px] p-5 md:flex-row md:items-center"
            >
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{l.name}</h3>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {l.isDepartment ? "Department" : "Physical location"}
                </div>
                {l.address && <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">📍 {l.address}</div>}
                {l.description && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{l.description}</div>}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditing(l);
                    setName(l.name);
                    setAddress(l.address || "");
                    setDescription(l.description || "");
                    setIsDepartment(l.isDepartment || false);
                    setSaveError("");
                    setShowModal(true);
                  }}
                  className="button-secondary !px-3 !py-2 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setDeleteError("");
                    setDeleteTarget(l);
                  }}
                  className="button-danger !px-3 !py-2 text-sm"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ADD / EDIT MODAL */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={resetModal}
          >
            <motion.form
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={softSpring}
              onSubmit={handleSave}
              className="surface-panel w-full max-w-md space-y-4 rounded-[28px] p-6 shadow-2xl"
            >
              <h2 className="text-xl font-semibold">{editing ? "Edit Location" : "Add Location"}</h2>
              {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}

              <input
                required
                className="input"
                placeholder="Location / Department name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isDepartment}
                  onChange={(e) => setIsDepartment(e.target.checked)}
                />
                This is a department (not a physical address)
              </label>

              {!isDepartment && (
                <input
                  className="input"
                  placeholder="Address (optional)"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              )}

              <textarea
                className="input h-28"
                placeholder="Description / notes (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={resetModal} className="button-secondary w-1/2">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="button-primary w-1/2 disabled:opacity-60">
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DELETE MODAL */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={softSpring}
              className="surface-panel w-full max-w-sm rounded-[28px] p-6 shadow-2xl"
            >
              <h2 className="text-lg font-semibold">Delete location?</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Delete <strong>{deleteTarget.name}</strong>? This cannot be undone.
              </p>
              {deleteError && <p role="alert" className="mt-2 text-sm text-red-600">{deleteError}</p>}
              <div className="mt-5 flex gap-2">
                <button onClick={() => setDeleteTarget(null)} className="button-secondary w-1/2">
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteTarget)}
                  disabled={deleting}
                  className="button-danger w-1/2 disabled:opacity-60"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}
