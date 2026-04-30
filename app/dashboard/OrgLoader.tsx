"use client";

import { useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useOrgStore } from "@/lib/orgStore";

type Unsubscribe = (() => void) | undefined;

export default function OrgLoader({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const set = useOrgStore((s) => s.setState);
  const reset = useOrgStore((s) => s.reset);

  useEffect(() => {
    let unsubUser: Unsubscribe;
    let unsubOrg: Unsubscribe;
    let unsubItems: Unsubscribe;
    let unsubVendors: Unsubscribe;
    let unsubMembers: Unsubscribe;
    let unsubLocations: Unsubscribe;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) {
        reset();
        router.push("/login");
        return;
      }

      unsubUser = onSnapshot(doc(db, "users", u.uid), (snap) => {
        const data = snap.data();
        if (!data?.orgId || data?.disabled || data?.accountStatus === "deactivated") {
          reset();
          void signOut(auth).finally(() => {
            router.push("/login?status=deactivated");
          });
          return;
        }

        const orgId = data.orgId;

        set({
          orgId,
          role: data.role || "member",
        });

        // ORG + PLAN
        unsubOrg?.();
        unsubOrg = onSnapshot(doc(db, "organizations", orgId), (o) => {
          set({
            plan:
              o.data()?.plan === "pro" ||
              o.data()?.plan === "premium" ||
              o.data()?.plan === "enterprise"
                ? o.data()?.plan
                : "basic",
          });
        });

        // ITEMS
        unsubItems?.();
        unsubItems = onSnapshot(
          collection(db, "organizations", orgId, "items"),
          (snap) => {
            set({ items: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
          }
        );

        // VENDORS
        unsubVendors?.();
        unsubVendors = onSnapshot(
          collection(db, "organizations", orgId, "vendors"),
          (snap) => {
            set({ vendors: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
          }
        );

        // MEMBERS
        unsubMembers?.();
        unsubMembers = onSnapshot(
          query(collection(db, "users"), where("orgId", "==", orgId)),
          (snap) => {
            set({
              members: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
              loading: false,
            });
          }
        );

        // 📍 LOCATIONS — THIS FIXES YOUR ERROR
        unsubLocations?.();
        unsubLocations = onSnapshot(
          collection(db, "organizations", orgId, "locations"),
          (snap) => {
            set({
              locations: snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              })),
              loading: false,
            });
          }
        );
      });
    });

    return () => {
      unsubAuth();
      unsubUser?.();
      unsubOrg?.();
      unsubItems?.();
      unsubVendors?.();
      unsubMembers?.();
      unsubLocations?.();
    };
  }, [router, reset, set]);

  const loading = useOrgStore((s) => s.loading);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-12 w-12 border-4 border-sky-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return <>{children}</>;
}
