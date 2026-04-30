"use client";

import type { User } from "firebase/auth";
import { auth } from "@/lib/firebase";

export async function finalizeClientSignIn(user: User) {
  const token = await user.getIdToken(true);

  const sessionRes = await fetch("/api/auth/set-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!sessionRes.ok) {
    throw new Error("Failed to start session");
  }

  const meRes = await fetch("/api/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!meRes.ok) {
    await auth.signOut();

    throw new Error(
      "No Restok workspace was found for this account yet. Use your subscribed account or complete signup first."
    );
  }

  return meRes.json();
}
