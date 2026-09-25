import "server-only";
import { randomUUID } from "node:crypto";
import { adminAuth } from "@/lib/auth/server";
import { getPool } from "@/lib/supabase/admin";

export class InternalError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Verify the caller is a signed-in internal admin. Returns the actor uid. */
export async function assertInternal(token: unknown): Promise<{ uid: string }> {
  if (typeof token !== "string" || !token) throw new InternalError("Missing token", 401);
  const decoded = await adminAuth.verifyIdToken(token);
  if (!decoded.internalAdmin) throw new InternalError("Unauthorized", 403);
  return { uid: decoded.uid };
}

/** Best-effort audit trail for internal admin actions. Never blocks the action. */
export async function logInternalAction(
  actorUid: string,
  orgId: string | null,
  type: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    await getPool().query(
      "insert into public.audit_logs(id, org_id, type, metadata) values ($1, $2, $3, $4)",
      [randomUUID(), orgId, type, JSON.stringify({ ...metadata, actorUid })]
    );
  } catch (error) {
    console.error("internal audit log failed", type, error);
  }
}

export function internalError(error: unknown) {
  if (error instanceof InternalError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("internal route error", error);
  return Response.json(
    { error: error instanceof Error ? error.message : "Request failed" },
    { status: 500 }
  );
}
