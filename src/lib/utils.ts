import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Drizzle returns numeric columns as strings - convert safely. */
export function toNum(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function formatINR(value: unknown, opts?: { compact?: boolean }): string {
  const n = toNum(value);
  if (opts?.compact && Math.abs(n) >= 100000) {
    return `₹${(n / 100000).toFixed(2)}L`;
  }
  if (opts?.compact && Math.abs(n) >= 1000) {
    return `₹${(n / 1000).toFixed(1)}K`;
  }
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatQty(value: unknown): string {
  const n = toNum(value);
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}

export function discountPercent(price: unknown, mrp: unknown): number | null {
  const p = toNum(price);
  const m = toNum(mrp);
  if (!m || m <= p) return null;
  return Math.round(((m - p) / m) * 100);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Normalise Indian phone numbers to +91XXXXXXXXXX form. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("091")) return `+${digits.slice(1)}`;
  if (input.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function timeAgo(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  PACKED: "Packed",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const UNIT_LABELS: Record<string, string> = {
  KG: "kg",
  G: "g",
  PIECE: "piece",
  PACKET: "packet",
  BOX: "box",
  BUNCH: "bunch",
  LITRE: "litre",
};

export const PRODUCT_TYPES = [
  "VEGETABLE",
  "FRUIT",
  "LEAFY_GREENS",
  "READY_TO_COOK",
  "DAIRY",
  "SALAD",
  "GROCERY",
] as const;

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function startOfDay(d = new Date()): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfDay(d = new Date()): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}
