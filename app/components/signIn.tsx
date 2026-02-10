"use client";

import { signIn } from "@/lib/auth-client";
import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    try {
      setLoading(true);
      await signIn();
    } catch (err) {
      console.error("Sign-in failed", err);
      setError(
        err instanceof Error ? err.message : "Unable to sign in right now.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFE2C7] p-4 text-[#933333] md:p-6">
      <div className="w-full max-w-sm border-2 border-[#933333] bg-[#FFE2C7] p-6 md:p-8">
        <h1 className="text-xl font-bold mb-2 md:text-2xl">Sign in</h1>

        <p className="text-sm text-[#933333]/80 mb-6">
          Continue with your Google account
        </p>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full border-2 border-[#933333] bg-[#933333] py-3 font-bold text-[#FFE2C7] transition hover:bg-[#7b2b2b] disabled:opacity-60"
        >
          {loading ? "Redirecting…" : "Sign in with Google"}
        </button>
        {error ? (
          <p className="mt-3 text-sm text-[#933333]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
