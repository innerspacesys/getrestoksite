import { auth } from "@/lib/auth/client";
import type { StockItem } from "@/lib/inventory";

export async function recordItemActivity(item: StockItem & { id: string }, action: "ordered" | "received" | "cancelled") {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch("/api/items/activity", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ itemId: item.id, action, expectedStart: (item.lastRestockedAt ?? item.createdAt)?.toDate().getTime() ?? null }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to save this change.");
}
