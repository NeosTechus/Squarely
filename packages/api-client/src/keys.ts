/** Stable TanStack Query cache keys, scoped by merchant for safe multi-tenant cache. */
export const qk = {
  merchant: (id: string) => ["merchant", id] as const,
  myMerchants: () => ["merchants", "mine"] as const,
  items: (merchantId: string) => ["items", merchantId] as const,
  item: (merchantId: string, itemId: string) => ["item", merchantId, itemId] as const,
  categories: (merchantId: string) => ["categories", merchantId] as const,
  modifierGroups: (merchantId: string) => ["modifier-groups", merchantId] as const,
  orders: (merchantId: string, filters?: Record<string, unknown>) =>
    ["orders", merchantId, filters ?? {}] as const,
  order: (merchantId: string, orderId: string) => ["order", merchantId, orderId] as const,
  openOrders: (merchantId: string) => ["orders", merchantId, "open"] as const,
  customers: (merchantId: string) => ["customers", merchantId] as const,
  inventory: (merchantId: string) => ["inventory", merchantId] as const,
  devices: (merchantId: string) => ["devices", merchantId] as const,
  subscription: (merchantId: string) => ["subscription", merchantId] as const,
};
