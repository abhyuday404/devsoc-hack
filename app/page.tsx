"use client";

import { signIn } from "@/lib/auth-client";
import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await signIn(); // redirects to Google
    } catch (err) {
      console.error("Sign-in failed", err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
        <h1 className="text-2xl font-semibold text-white mb-2">Sign in</h1>

        <p className="text-sm text-neutral-400 mb-6">
          Continue with your Google account
        </p>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full rounded-lg bg-white py-3 font-medium text-black hover:bg-neutral-200 transition disabled:opacity-60"
        >
          {loading ? "Redirecting…" : "Sign in with Google"}
        </button>
      </div>
    </div>
  );
}
