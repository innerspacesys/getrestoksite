import { Suspense } from "react";
import LoginClient from "./login-client";



export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-slate-500 dark:text-slate-400">
          Loading…
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
