import { requireMember, apiError, ApiError } from "@/lib/apiAuth";
import { adminAuth } from "@/lib/auth/server";
export async function POST(req: Request) {
 try {
  const { uid,user,userRef } = await requireMember(req);
  if(user.role === "owner") throw new ApiError("Transfer ownership before deleting your account.",403);
  await adminAuth.deleteUser(uid);
  await userRef.delete();
  return Response.json({success:true});
 } catch(error) { return apiError(error); }
}
