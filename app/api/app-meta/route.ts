import { NextResponse } from "next/server";
import { getPublicAppMeta } from "@/lib/appMeta";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getPublicAppMeta(), {
    headers: {
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
