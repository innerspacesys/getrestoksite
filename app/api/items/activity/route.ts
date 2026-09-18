import { FieldValue, Timestamp } from "@/lib/data/server";
import { adminDb } from "@/lib/auth/server";
import { apiError, ApiError, requireMember } from "@/lib/apiAuth";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export async function POST(req: Request) {
  try {
    const { uid, user, orgRef } = await requireMember(req);
    const { itemId, action, expectedStart } = await req.json();
    if (typeof itemId !== "string" || !itemId || itemId.includes("/") || !["ordered", "received", "cancelled"].includes(action)) throw new ApiError("Invalid item action.");
    const ref = orgRef.collection("items").doc(itemId);
    await adminDb.runTransaction(async (tx) => {
      const item = (await tx.get(ref)).data();
      if (!item) throw new ApiError("Item no longer exists.", 404);
      if (action === "ordered" && item.orderStatus === "ordered") throw new ApiError("A teammate already marked this ordered. Refresh to see it.", 409);
      if (action === "cancelled" && item.orderStatus !== "ordered") throw new ApiError("This item has no pending order.", 409);
      const start = (item.lastRestockedAt ?? item.createdAt)?.toDate?.().getTime() ?? null;
      if (action === "received" && (typeof expectedStart !== "number" || expectedStart !== start)) throw new ApiError("This item changed. Refresh before recording another restock.", 409);
      const at = Timestamp.now();
      const actorName = user.name || user.email || "Team member";
      let changes: Record<string, unknown>;
      if (action === "received") {
        // Restocking restarts the countdown and clears any active snooze.
        changes = { lastRestockedAt: at, orderStatus: "idle", snoozedUntil: null, orderedAt: FieldValue.delete(), orderedByName: FieldValue.delete() };
        // Learn how long the supply actually lasted this cycle (start -> now)
        // so the estimate self-corrects toward real usage over time.
        if (start != null) {
          const intervalDays = Math.round((at.toMillis() - start) / 86400000);
          if (intervalDays >= 1 && intervalDays <= 730) {
            const prior: number[] = Array.isArray(item.recentIntervals)
              ? item.recentIntervals.filter((n: unknown): n is number => typeof n === "number" && Number.isFinite(n))
              : [];
            const recentIntervals = [...prior, intervalDays].slice(-8);
            changes.recentIntervals = recentIntervals;
            changes.restockCount = (typeof item.restockCount === "number" ? item.restockCount : 0) + 1;
            changes.learnedDays = median(recentIntervals);
          }
        }
      } else if (action === "ordered") {
        changes = { orderStatus: "ordered", orderedAt: at, orderedByName: actorName };
      } else {
        changes = { orderStatus: "idle", orderedAt: FieldValue.delete(), orderedByName: FieldValue.delete() };
      }
      tx.update(ref, changes);
      tx.create(ref.collection("activity").doc(), { action, at, actorUid: uid, actorName, previousStart: start, itemName: item.name || "Item" });
    });
    return Response.json({ success: true });
  } catch (error) { return apiError(error); }
}

export async function GET(req: Request) {
  try {
    const { orgRef } = await requireMember(req);
    const itemId = new URL(req.url).searchParams.get("itemId");
    if (!itemId || itemId.includes("/")) throw new ApiError("Invalid item.");
    const snapshot = await orgRef.collection("items").doc(itemId).collection("activity").orderBy("at", "desc").limit(50).get();
    return Response.json({ events: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), at: doc.data().at.toDate().toISOString() })) });
  } catch (error) { return apiError(error); }
}
