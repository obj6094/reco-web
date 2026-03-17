import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Date+time in 24-hour format, minutes only (no seconds) */
export function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
    hour12: false,
  });
}

