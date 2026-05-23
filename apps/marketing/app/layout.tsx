import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Sora } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Squarely — Run your business from one screen",
  description:
    "POS, self-order kiosk, kitchen display, inventory, customers, and reporting — one platform. The modern alternative to Square and Clover.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
