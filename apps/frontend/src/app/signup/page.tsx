import { Suspense } from "react";

import { GoogleAuthPanel } from "@/components/GoogleAuthPanel";

export default function SignupPage() {
  return (
    <Suspense>
      <GoogleAuthPanel mode="signup" />
    </Suspense>
  );
}
