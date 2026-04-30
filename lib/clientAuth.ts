"use client";

import type { User } from "firebase/auth";
import { auth } from "@/lib/firebase";

type FinalizeClientSignInOptions = {
  turnstileToken?: string;
};

export async function finalizeClientSignIn(
  user: User,
  options: FinalizeClientSignInOptions = {}
) {
  const token = await user.getIdToken(true);

  const sessionRes = await fetch("/api/auth/set-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      turnstileToken: options.turnstileToken,
    }),
  });

  if (!sessionRes.ok) {
    const data = (await sessionRes.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(data?.error || "Failed to start session");
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
