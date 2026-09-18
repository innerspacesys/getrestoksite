import { apiError, ApiError, requireMember } from "@/lib/apiAuth";
import { validEmail } from "@/lib/notificationPreferences";

export async function POST(req: Request) {
  try {
    const { userRef } = await requireMember(req);
    const body = await req.json();
    if (typeof body.notificationEmail !== "string" || typeof body.emailNotifications !== "boolean" || typeof body.lowStockAlerts !== "boolean") throw new ApiError("Invalid preferences.");
    const notificationEmail = body.notificationEmail.trim();
    if (notificationEmail && !validEmail(notificationEmail)) throw new ApiError("Enter a valid notification email address.");
    await userRef.update({ notificationEmail, emailNotifications: body.emailNotifications, lowStockAlerts: body.lowStockAlerts });
    return Response.json({ success: true });
  } catch (error) { return apiError(error); }
}
