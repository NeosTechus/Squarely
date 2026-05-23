// Plain module (not a Server Action file) so it can export non-function values.
export type MerchantRole =
  | "owner"
  | "admin"
  | "manager"
  | "cashier"
  | "kitchen"
  | "viewer";

export const MERCHANT_ROLES: MerchantRole[] = [
  "owner",
  "admin",
  "manager",
  "cashier",
  "kitchen",
  "viewer",
];
