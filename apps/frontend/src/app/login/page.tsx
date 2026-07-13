import { Suspense } from "react";

import { GoogleAuthPanel } from "@/components/GoogleAuthPanel";

export default function LoginPage() {
  return (
    <Suspense>
      <GoogleAuthPanel mode="login" />
    </Suspense>
  );
}
