"use client";

import { Suspense } from "react";
import LoginForm from "./login-form";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-ink-soft">Lade Login …</div>}>
      <LoginForm />
    </Suspense>
  );
}
