import { onDocumentWritten } from "firebase-functions/firestore"
import { FieldValue, Timestamp } from "firebase-admin/firestore"

export const onItemRefill = onDocumentWritten(
  "users/{userId}/items/{itemId}",
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after) return

    // Only run if createdAt changed (refill)
    if (
      !before.createdAt ||
      !after.createdAt ||
      before.createdAt.toMillis() === after.createdAt.toMillis()
    ) {
      return
    }

    if (!event.data) return

    const itemRef = event.data.after.ref
    const now = after.createdAt.toDate()

    const history: Timestamp[] = Array.isArray(after.refillHistory)
      ? after.refillHistory
      : []

    const updatedHistory = [...history, after.createdAt].slice(-8)

    if (updatedHistory.length < 2) {
      await itemRef.update({
        refillHistory: updatedHistory,
      })
      return
    }

    // Compute intervals
    const intervals: number[] = []
    for (let i = 1; i < updatedHistory.length; i++) {
      const days =
        (updatedHistory[i].toMillis() - updatedHistory[i - 1].toMillis()) /
        86400000
      intervals.push(Math.max(1, Math.round(days)))
    }

    const latestInterval = intervals[intervals.length - 1]
    const prevExpected = after.expectedIntervalDays ?? intervals[0]

    const expected =
      intervals.length === 1
        ? latestInterval
        : Math.round(0.3 * latestInterval + 0.7 * prevExpected)

    const confidence = Math.min(1, intervals.length / 5)

    const leadTime =
      expected >= 30 ? 7 :
      expected >= 14 ? 5 :
      expected >= 7  ? 3 :
      2

    const nextReminderAt = new Date(
      now.getTime() + (expected - leadTime) * 86400000
    )

    await itemRef.update({
      refillHistory: updatedHistory,
      expectedIntervalDays: expected,
      confidence,
      nextReminderAt: Timestamp.fromDate(nextReminderAt),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }
)
