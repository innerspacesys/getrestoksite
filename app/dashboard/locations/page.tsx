"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
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
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
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

  const [deleteTarget, setDeleteTarget] = useState<LocationDoc | null>(null);

  // --------------------------
  // SAVE
  // --------------------------
  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgId) return;

    const payload = {
      name: name.trim(),
      address: address.trim() || null,
      description: description.trim() || null,
      isDepartment,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editing) {
        await updateDoc(
          doc(db, "organizations", orgId, "locations", editing.id),
          payload
        );
      } else {
        await addDoc(collection(db, "organizations", orgId, "locations"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      resetModal();
    } catch (err) {
      console.error("Failed to save location", err);
      alert("Failed to save. Check console.");
    }
  }

  function resetModal() {
    setShowModal(false);
    setEditing(null);
    setName("");
    setAddress("");
    setDescription("");
    setIsDepartment(false);
  }

  // --------------------------
  // DELETE (safe)
  // --------------------------
  async function handleDelete(loc: LocationDoc) {
    if (!orgId) return;

    const itemsSnap = await getDocs(
      query(
        collection(db, "organizations", orgId, "items"),
        where("locationId", "==", loc.id)
      )
    );

    if (!itemsSnap.empty) {
      alert("This location is currently assigned to one or more items.");
      return;
    }

    await deleteDoc(doc(db, "organizations", orgId, "locations", loc.id));
    setDeleteTarget(null);
  }

  // --------------------------
  // LOADING
  // --------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center w-full min-h-screen">
        <div className="animate-spin h-12 w-12 border-4 border-sky-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // --------------------------
  // PLAN LOGIC
  // --------------------------
  const planKey =
    plan === "pro" || plan === "premium" || plan === "enterprise"
      ? plan
      : "basic";
  const planConfig = PLANS[planKey];
  const locationLimit =
    "limits" in planConfig ? planConfig.limits.locations : Infinity;
  const atLimit =
    locationLimit !== Infinity && locations.length >= locationLimit;

  return (
    <motion.main
      className="mx-auto flex-1 max-w-6xl p-4 md:p-10"
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
              Locations can represent departments like Accounting or Warehouse,
              or physical places like a main office or storage closet. Use them
              however your operation thinks about space.
            </p>
          </div>

          <div className="rounded-3xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100 lg:min-w-[240px]">
            <div className="font-semibold">Current usage</div>
            <div className="mt-1">
              <strong>{locations.length}</strong> / {locationLimit === Infinity ? "∞" : locationLimit} locations
            </div>
            <button
              onClick={() => {
                if (atLimit) {
                  alert("You've reached the location limit for your current plan.");
                  return;
                }
                setShowModal(true);
              }}
              className={`mt-3 w-full rounded-2xl px-4 py-2.5 font-medium text-white ${
                atLimit
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-sky-600 hover:bg-sky-700"
              }`}
            >
              + Add Location
            </button>
          </div>
        </div>
      </section>

      {/* UPGRADE NOTICE */}
      {atLimit && locationLimit !== Infinity && (
        <div className="mt-4 p-4 rounded-xl border bg-amber-50 dark:bg-slate-800 dark:border-slate-700">
          <strong>Want to add more locations?</strong>
          <p className="text-sm mt-1 text-slate-600 dark:text-slate-400">
            Your <strong>{planConfig.name}</strong> plan includes{" "}
            {locationLimit} location{locationLimit === 1 ? "" : "s"}.
            Upgrade for more.
          </p>

          <button
            className="mt-3 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded"
            onClick={() =>
              (window.location.href = "/dashboard/settings#billing")
            }
          >
            Upgrade Plan
          </button>
        </div>
      )}

      {/* LIST */}
      <div className="mt-6 space-y-3">
        {locations.length === 0 && (
          <div className="p-10 border border-dashed rounded-xl text-center text-slate-500 dark:text-slate-400">
            No locations yet.
          </div>
        )}

        {locations.map((location, i) => {
          const l = location as LocationDoc;

          return (
          <motion.div
              key={l.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="p-4 rounded-xl border bg-white dark:bg-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center"
            >
              <div>
              <h3 className="font-semibold">{l.name}</h3>

              <div className="text-sm text-slate-500 dark:text-slate-400">
                {l.isDepartment ? "Department" : "Physical Location"}
              </div>

              {l.address && (
                <div className="text-sm mt-1">📍 {l.address}</div>
              )}

              {l.description && (
                <div className="text-xs mt-1 text-slate-500">
                  {l.description}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditing(l);
                  setName(l.name);
                  setAddress(l.address || "");
                  setDescription(l.description || "");
                  setIsDepartment(l.isDepartment || false);
                  setShowModal(true);
                }}
                className="px-3 py-1.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-sm"
              >
                Edit
              </button>

              <button
                onClick={() => setDeleteTarget(l)}
                className="px-3 py-1.5 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm"
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowModal(false)}
          >
            <motion.form
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: "spring", stiffness: 240, damping: 20 }}
              onSubmit={handleSave}
              className="bg-white dark:bg-slate-900 p-6 rounded-xl w-full max-w-md shadow-2xl border"
            >
              <h2 className="text-xl font-semibold mb-4">
                {editing ? "Edit Location" : "Add Location"}
              </h2>

              <input
                required
                className="input mb-3"
                placeholder="Location / Department Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <label className="flex items-center gap-2 text-sm mb-3">
                <input
                  type="checkbox"
                  checked={isDepartment}
                  onChange={(e) => setIsDepartment(e.target.checked)}
                />
                This is a department (not a physical address)
              </label>

              {!isDepartment && (
                <input
                  className="input mb-3"
                  placeholder="Address (optional)"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              )}

              <textarea
                className="input h-28 mb-4"
                placeholder="Description / notes (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetModal}
                  className="w-1/2 border p-3 rounded"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="w-1/2 bg-sky-600 hover:bg-sky-700 text-white p-3 rounded"
                >
                  Save
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: "spring", stiffness: 240, damping: 20 }}
              className="bg-white dark:bg-slate-900 p-6 rounded-xl w-full max-w-sm shadow-2xl border"
            >
              <h2 className="text-lg font-semibold">Delete location?</h2>

              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                This cannot be undone.
              </p>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="w-1/2 border p-3 rounded"
                >
                  Cancel
                </button>

                <button
                  onClick={() => handleDelete(deleteTarget)}
                  className="w-1/2 bg-red-600 hover:bg-red-700 text-white p-3 rounded"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}
