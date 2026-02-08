"use client";

export default function LoginPage() {
  return (
    <button
      onClick={() => {
        window.location.href = "/api/auth/signin/google";
      }}
    >
      Sign in with Google
    </button>
  );
}
