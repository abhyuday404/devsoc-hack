"use client";

import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient();

export const signIn = async () => {
  const response = await authClient.signIn.social({
    provider: "google",
    callbackURL: "/dashboard",
  });
  if (response.error) {
    throw new Error(response.error.message || "Sign-in failed");
  }
  return response.data;
};

export const signOut = async () => {
  const data = await authClient.signOut();
  return data;
};

export { authClient };
