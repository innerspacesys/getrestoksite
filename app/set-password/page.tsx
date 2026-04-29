import { Suspense } from "react";
import SetPasswordForm from "./SetPasswordForm";

export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-slate-500 dark:text-slate-400">
          Loading…
        </div>
      }
    >
      <SetPasswordForm />
    </Suspense>
  );
}
