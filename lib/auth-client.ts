"use client";

export const signIn = () => {
  window.location.href = "/api/auth/signin/google";
};

export const signOut = () => {
  window.location.href = "/api/auth/signout";
};

