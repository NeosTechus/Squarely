import { z } from "zod";

export const DeviceKind = z.enum([
  "ios_phone",
  "ios_tablet",
  "android_phone",
  "android_tablet",
  "kds_display",
  "kiosk_terminal",
]);
export type DeviceKind = z.infer<typeof DeviceKind>;

export const BootMode = z.enum(["pos", "kiosk", "kds", "admin"]);
export type BootMode = z.infer<typeof BootMode>;

export const Device = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  location_id: z.string().uuid().nullable(),
  name: z.string(),
  kind: DeviceKind,
  boot_mode: BootMode,
  last_seen_at: z.string().datetime().nullable(),
  app_version: z.string().nullable(),
  os_version: z.string().nullable(),
  push_token: z.string().nullable(),
  active: z.boolean().default(true),
  created_at: z.string().datetime(),
});
export type Device = z.infer<typeof Device>;

export const Terminal = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  device_id: z.string().uuid().nullable(),
  provider: z.enum(["valor", "stripe_terminal", "square_reader"]),
  epi: z.string().nullable(),
  serial: z.string().nullable(),
  label: z.string(),
  active: z.boolean().default(true),
});
export type Terminal = z.infer<typeof Terminal>;

export const Printer = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  label: z.string(),
  model: z.string(),
  ip_address: z.string().nullable(),
  serial: z.string().nullable(),
  cloud_device_id: z.string().nullable(),
  supports_cash_drawer: z.boolean().default(true),
  active: z.boolean().default(true),
});
export type Printer = z.infer<typeof Printer>;

export const Location = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  name: z.string(),
  address_line1: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  postal_code: z.string().nullable(),
  timezone: z.string(),
  active: z.boolean().default(true),
});
export type Location = z.infer<typeof Location>;
