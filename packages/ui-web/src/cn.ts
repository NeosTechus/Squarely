import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge class names with Tailwind-aware conflict resolution
 *  (so a passed className reliably overrides component defaults). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
