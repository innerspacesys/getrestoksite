"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/auth/client";
import { db } from "@/lib/data/client";
import { onAuthStateChanged, signOut } from "@/lib/auth/client";
import {
  doc,
  collection,
  onSnapshot,
  query,
  where,
} from "@/lib/data/client";
import { useRouter } from "next/navigation";
import { useOrgStore } from "@/lib/orgStore";
import InactiveOrgScreen from "@/components/InactiveOrgScreen";

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
      unsubUser?.(); unsubOrg?.(); unsubItems?.(); unsubVendors?.(); unsubMembers?.(); unsubLocations?.();
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

        // ORG + PLAN + ACTIVE STATE
        // A member can always read their own org row (even when inactive), so
        // an unreadable/missing row means the workspace is gone or blocked —
        // treat it as inactive rather than spinning forever.
        unsubOrg?.();
        unsubOrg = onSnapshot(doc(db, "organizations", orgId), (o) => {
          const org = o.exists() ? o.data() : null;
          const plan = org?.plan;
          set({
            orgActive: org ? org.active !== false : false,
            scheduledDeletionAt:
              org?.scheduledDeletionAt?.toDate?.().toISOString() ?? null,
            plan:
              plan === "pro" || plan === "premium" || plan === "enterprise"
                ? plan
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

        // LOCATIONS
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
  const orgActive = useOrgStore((s) => s.orgActive);
  const role = useOrgStore((s) => s.role);
  const orgId = useOrgStore((s) => s.orgId);

  // While either the collections or the org row are still resolving, show a
  // spinner — but never forever. If a read hangs, surface a retry screen.
  const resolving = loading || orgActive === null;
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!resolving) return;
    const t = setTimeout(() => setTimedOut(true), 12000);
    // Leaving the resolving state clears the timer and resets the flag for any
    // future resolve cycle (e.g. sign out and back in).
    return () => {
      clearTimeout(t);
      setTimedOut(false);
    };
  }, [resolving]);

  if (resolving) {
    if (!timedOut) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin h-12 w-12 border-4 border-sky-600 border-t-transparent rounded-full" />
        </div>
      );
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-slate-500 dark:text-slate-400">
          We couldn&apos;t load your workspace.
        </p>
        <button onClick={() => window.location.reload()} className="button-primary">
          Try again
        </button>
      </div>
    );
  }

  if (orgActive === false) {
    return (
      <InactiveOrgScreen
        orgId={orgId}
        role={role}
      />
    );
  }

  return <>{children}</>;
}
