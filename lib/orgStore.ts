import { create } from "zustand";

export type OrgItem = Record<string, unknown> & { id: string };
export type OrgVendor = Record<string, unknown> & { id: string };
export type OrgMember = Record<string, unknown> & {
  id: string;
  email?: string;
  role?: "owner" | "admin" | "member";
};
export type OrgLocation = Record<string, unknown> & { id: string };

type OrgState = {
  orgId: string | null;
  plan: string | null;
  role: "owner" | "admin" | "member" | null;

  items: OrgItem[];
  vendors: OrgVendor[];
  members: OrgMember[];
  locations: OrgLocation[];

  loading: boolean;

  setState: (data: Partial<OrgState>) => void;
  reset: () => void;
};

export const useOrgStore = create<OrgState>((set) => ({
  orgId: null,
  plan: null,
  role: null,

  items: [],
  vendors: [],
  members: [],
  locations: [],

  loading: true,

  setState: (data) => set((s) => ({ ...s, ...data })),
  reset: () =>
    set({
      orgId: null,
      plan: null,
      role: null,
      items: [],
      vendors: [],
      members: [],
      locations: [],
      loading: true,
    }),
}));
