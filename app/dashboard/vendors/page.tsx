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
  const { orgId, vendors, loading } = useOrgData();

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
    if (!orgId) return;

    const payload = {
      name: name.trim(),
      email: email.trim() || null,
      website: website.trim() || null,
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
      alert("Failed to save vendor. Check console.");
    }
  }

  function resetModal() {
    setShowModal(false);
    setEditingVendor(null);
    setName("");
    setEmail("");
    setWebsite("");
    setHasStore(false);
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

      {/* LIST */}
      <div className="mt-6 space-y-3">
        {vendors.length === 0 && (
          <div className="p-10 border border-dashed rounded-xl text-center text-slate-500 dark:text-slate-400">
            No vendors yet.
          </div>
        )}

        {vendors.map((vendor, i) => {
          const v = vendor as VendorDoc;

          return (
          <motion.div
            key={v.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            className="p-4 rounded-xl border bg-white dark:bg-slate-800 dark:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center"
          >
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                {v.name}
              </h3>

              <div className="text-sm text-slate-500 dark:text-slate-400">
                {v.email && <div>📧 {v.email}</div>}
                {v.website && <div>🌐 {v.website}</div>}
                {!v.email && !v.website && <div>No contact info</div>}

                <div className="mt-1">
                  {v.hasPhysicalStore ? (
                    <span className="text-green-600 dark:text-green-400">
                      🏬 Has physical store
                    </span>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">
                      🏢 Online only
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-3 md:mt-0">
              <button
                onClick={() => {
                  setEditingVendor(v);
                  setName(v.name);
                  setEmail(v.email || "");
                  setWebsite(v.website || "");
                  setHasStore(v.hasPhysicalStore || false);
                  setShowModal(true);
                }}
                className="px-3 py-1.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-sm"
              >
                Edit
              </button>

              <button
                onClick={() => setDeleteVendor(v)}
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
      {showModal && (
        <motion.div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
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
              placeholder="Vendor name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              className="input"
              placeholder="Vendor email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              className="input"
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

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={resetModal}
                className="w-1/2 border p-3 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="w-1/2 bg-sky-600 hover:bg-sky-700 text-white p-3 rounded transition"
              >
                Save
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}

      {/* DELETE CONFIRM */}
      {deleteVendor && (
        <motion.div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
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
