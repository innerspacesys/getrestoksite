"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

async function setReorderMethod(
  orgId: string,
  itemId: string,
  method: "email" | "website"
) {
  await updateDoc(
    doc(db, "organizations", orgId, "items", itemId),
    { reorderMethod: method }
  );
}

type ItemDoc = {
  id: string;
  name: string;
  vendorId?: string | null;
  reorderMethod?: "email" | "website";
};

type VendorDoc = {
  id: string;
  name: string;
  email?: string | null;
  website?: string | null;
};

type Unsubscribe = (() => void) | undefined;

export default function RestockPage() {
  const router = useRouter();

  // REVIEW MODE (?review=ID,ID,… from Dashboard)
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;

  const reviewIds: string[] =
    searchParams?.get("review")?.split(",").filter(Boolean) ?? [];

  const [user, setUser] = useState<User | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  const [items, setItems] = useState<ItemDoc[]>([]);
  const [vendors, setVendors] = useState<Record<string, VendorDoc>>({});

  const [showRestockConfirm, setShowRestockConfirm] = useState(false);
  const [restockingItem, setRestockingItem] = useState<ItemDoc | null>(null);

  // ---------- LOADING FLAGS ----------
  const [planLoaded, setPlanLoaded] = useState(false);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [vendorsLoaded, setVendorsLoaded] = useState(false);
  const loadingPage = !planLoaded || !itemsLoaded || !vendorsLoaded;

  // ---------------------------------
  // AUTH → USER → ORG → PLAN + DATA
  // ---------------------------------
  useEffect(() => {
    let unsubUser: Unsubscribe;
    let unsubOrg: Unsubscribe;
    let unsubItems: Unsubscribe;
    let unsubVendors: Unsubscribe;

    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }

      setUser(currentUser);

      unsubUser = onSnapshot(
        doc(db, "users", currentUser.uid),
        (userSnap) => {
          const org = userSnap.data()?.orgId;
          if (!org) return;

          setOrgId(org);

          // PLAN
          unsubOrg?.();
          unsubOrg = onSnapshot(
            doc(db, "organizations", org),
            () => {
              setPlanLoaded(true);
            }
          );

          // ORG VENDORS
          unsubVendors?.();
          unsubVendors = onSnapshot(
            collection(db, "organizations", org, "vendors"),
            (snap) => {
              const map: Record<string, VendorDoc> = {};
              snap.docs.forEach((d) => {
                map[d.id] = {
                  id: d.id,
                  ...(d.data() as Omit<VendorDoc, "id">),
                };
              });
              setVendors(map);
              setVendorsLoaded(true);
            }
          );

          // ORG ITEMS
          unsubItems?.();
          unsubItems = onSnapshot(
            collection(db, "organizations", org, "items"),
            (snap) => {
              setItems(
                snap.docs.map((d) => ({
                  id: d.id,
                  ...(d.data() as Omit<ItemDoc, "id">),
                })) as ItemDoc[]
              );
              setItemsLoaded(true);
            }
          );
        }
      );
    });

    return () => {
      unsubAuth();
      unsubUser?.();
      unsubOrg?.();
      unsubItems?.();
      unsubVendors?.();
    };
  }, [router]);

  // ---------------------------------
  // HELPERS
  // ---------------------------------
  //function isInnerSpaceVendor(v?: VendorDoc) {
   // if (!v?.name) return false;
   // const n = v.name.toLowerCase();
   // return n.includes("inner space") || n.includes("issi");
  //}

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

 // function buildInnerSpaceEmail(item: ItemDoc) {
   // const subject = `Restock Request – ${item.name}`;
   // const body = `Hello Inner Space Systems,

//I would like to place a restock order for:

//Item: ${item.name}

//This request was sent from Restok.

//Thank you,
//${user?.displayName || user?.email || "—"}`;

//    return `mailto:sales@issioffice.com?subject=${encodeURIComponent(
 //     subject
 //   )}&body=${encodeURIComponent(body)}`;
 // }

  function buildVendorEmail(vendor: VendorDoc, item: ItemDoc) {
    const subject = `Restock Request – ${item.name}`;
    const body = `Hello ${vendor.name},

I would like to place a restock order for:

Item: ${item.name}

Thank you,
${user?.displayName || user?.email || "—"}`;

    return `mailto:${vendor.email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  }

  // ---------------------------------
  // LOADING SCREEN
  // ---------------------------------
  if (loadingPage) {
    return (
      <motion.main
        className="p-4 md:p-10 flex-1 flex items-center justify-center min-h-screen"
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-sky-500 border-t-transparent" />
          <p className="text-sm text-slate-500">
            Getting your restock list ready…
          </p>
        </div>
      </motion.main>
    );
  }

  // ---------------------------------
  // UI
  // ---------------------------------
  return (
    <motion.main
      className="p-4 md:p-10 flex-1 max-w-full md:max-w-5xl mx-auto"
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
    >
      <h1 className="text-3xl font-bold">Restock</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Reorder items using your saved vendors.
      </p>

      {/*
        PRO SAVINGS BANNER (commented out)

        Original block removed to avoid rendering. If you want to restore,
        uncomment and adjust as needed.

        {isProOrHigher && (
          <div className="mt-6 p-4 rounded-xl bg-sky-50 dark:bg-sky-900/30 border flex justify-between items-center">
            <p className="text-sm">💡 Save money on supplies with Inner Space Systems</p>
            <button
              onClick={() => setShowSavingsModal(true)}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm"
            >
              Learn More
            </button>
          </div>
        )}
      */}

      {/* ITEMS LIST */}
      <div className="mt-6 space-y-4">
        {items.length === 0 && (
          <div className="p-8 rounded-xl border text-center text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800">
            No items yet. Add items first, then come back here to restock them.
          </div>
        )}

        {items.map((item) => {
          const vendor = item.vendorId
            ? vendors[item.vendorId]
            : undefined;

          return (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition
                ${
                  reviewIds.includes(item.id)
                    ? "bg-amber-50 dark:bg-amber-900/30 border-amber-400"
                    : "bg-white dark:bg-slate-800"
                }`}
            >
              <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                <h3 className="font-semibold">{item.name}</h3>

                {reviewIds.includes(item.id) && (
                  <span className="inline-block mt-1 text-xs px-2 py-1 rounded bg-amber-200">
                    Needs attention
                  </span>
                )}

                <p className="text-sm text-slate-500">
                  Vendor: {vendor?.name || "Not set"}
                </p>
              </div>

              {!vendor ? (
                <span className="text-xs italic text-slate-400">
                  No vendor linked
                </span>
             // ) : isInnerSpaceVendor(vendor) ? (
             //   <a
             //     href={buildInnerSpaceEmail(item)}
              //    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm"
              //  >
               //   Email Inner Space
               // </a>
              ) : (
                <div className="flex items-center gap-3 mt-3 md:mt-0">
                  {/* EMAIL vs WEBSITE toggle */}
                  {vendor.email && vendor.website && orgId && (
                    <div className="flex rounded-md overflow-hidden border">
                      {(["email", "website"] as const).map((method) => (
                        <button
                          key={method}
                          onClick={() =>
                            setReorderMethod(orgId, item.id, method)
                          }
                          className={`px-3 py-1 text-xs ${
                            item.reorderMethod === method ||
                            (!item.reorderMethod && method === "email")
                              ? "bg-sky-600 text-white"
                              : "bg-white dark:bg-slate-800"
                          }`}
                        >
                          {method === "email" ? "Email" : "Website"}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ACTION BUTTON */}
                  {((item.reorderMethod ?? "email") === "email" &&
                  vendor.email) ? (
                    <button
                      onClick={() => {
                        window.location.href = buildVendorEmail(
                          vendor,
                          item
                        );
                        setRestockingItem(item);
                        setShowRestockConfirm(true);
                      }}
                      className="w-full md:w-auto px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm"
                    >
                      Email Vendor
                    </button>
                  ) : vendor.website ? (
                    <button
                      onClick={() => {
                        window.open(
                          buildVendorSearchUrl(vendor, item.name)!,
                          "_blank"
                        );
                        setRestockingItem(item);
                        setShowRestockConfirm(true);
                      }}
                      className="w-full md:w-auto px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm"
                    >
                      Search Site
                    </button>
                  ) : (
                    <span className="text-xs italic text-slate-400">
                      No contact info
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {
        /*
          SAVINGS MODAL (commented out)

          Original modal preserved here for easy restoration. To re-enable,
          remove this comment wrapper.

          {showSavingsModal && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl max-w-md w-full space-y-4">
                <h2 className="text-lg font-semibold">Save on Office Supplies</h2>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  You could save money by switching your vendor to
                  <strong> Inner Space Systems</strong>.
                </p>

                <a
                  href="https://www.issioffice.com/office-supplies"
                  className="block text-center bg-sky-600 hover:bg-sky-700 text-white py-2 rounded-md"
                  target="_blank"
                >
                  Visit ISSI
                </a>

                <button
                  onClick={() => setShowSavingsModal(false)}
                  className="w-full border py-2 rounded-md"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        */
      }

      {/* RESTOCK CONFIRM */}
      {showRestockConfirm && restockingItem && orgId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl max-w-md w-full space-y-4">
            <h2 className="text-lg font-semibold">Restock item?</h2>

            <p className="text-sm text-slate-700 dark:text-slate-300">
              Did you restock{" "}
              <strong>{restockingItem.name}</strong>?
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowRestockConfirm(false);
                  setRestockingItem(null);
                }}
                className="w-1/2 border py-2 rounded-md"
              >
                Not yet
              </button>

              <button
                onClick={async () => {
                  await updateDoc(
                    doc(
                      db,
                      "organizations",
                      orgId,
                      "items",
                      restockingItem.id
                    ),
                    { createdAt: new Date() }
                  );

                  setShowRestockConfirm(false);
                  setRestockingItem(null);
                  router.replace("/dashboard/restock");
                }}
                className="w-1/2 bg-green-600 hover:bg-green-700 text-white py-2 rounded-md"
              >
                Yes, restocked
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.main>
  );
}
