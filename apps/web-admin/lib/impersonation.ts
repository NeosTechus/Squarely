"use client";

// Lets a platform admin "view as" a specific merchant. Stored client-side;
// RLS still governs access (only platform admins can read others' data).
const KEY = "squarely_view_as_merchant";

export function getImpersonatedMerchant(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setImpersonatedMerchant(id: string) {
  window.localStorage.setItem(KEY, id);
}

export function clearImpersonatedMerchant() {
  window.localStorage.removeItem(KEY);
}
