import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { apiError, ApiError, requireMember } from "@/lib/apiAuth";

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
      const changes = action === "received"
        ? { lastRestockedAt: at, orderStatus: "idle", orderedAt: FieldValue.delete(), orderedByName: FieldValue.delete() }
        : action === "ordered"
          ? { orderStatus: "ordered", orderedAt: at, orderedByName: actorName }
          : { orderStatus: "idle", orderedAt: FieldValue.delete(), orderedByName: FieldValue.delete() };
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
