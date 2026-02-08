"use client";

import { signIn } from "@/lib/auth-client";

export default function LoginPage() {
  return (
    <button
      onClick={async () => {
        await signIn();
      }}
    >
      Sign in with Google
    </button>
  );
}
