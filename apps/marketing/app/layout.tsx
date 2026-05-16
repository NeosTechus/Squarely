import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Squarely — Run your business from one screen",
  description:
    "Multi-tenant POS, Kiosk, and KDS in one app. Hardware-ready: receipt printers, card readers, barcode scanners, cash drawers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
