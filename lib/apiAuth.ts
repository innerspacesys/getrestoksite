import { adminAuth, adminDb } from "@/lib/auth/server";

export class ApiError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function requireMember(req: Request) {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new ApiError("Please sign in again.", 401);
  const decoded = await adminAuth.verifyIdToken(token, true).catch(() => { throw new ApiError("Please sign in again.", 401); });
  const userRef = adminDb.collection("users").doc(decoded.uid);
  const user = (await userRef.get()).data();
  if (!user?.orgId || user.disabled || user.accountStatus === "deactivated") throw new ApiError("Workspace access unavailable.", 403);
  const orgRef = adminDb.collection("organizations").doc(user.orgId);
  const org = (await orgRef.get()).data();
  if (!org || org.active === false) throw new ApiError("Workspace is inactive.", 403);
  return { uid: decoded.uid, user, userRef, orgRef, org };
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  console.error("Request failed", error);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
