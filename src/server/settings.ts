
import { db } from "@/db";
import { settings as settingsTable } from "@/db/schema";
import { inArray } from "drizzle-orm";

export type StoreSettings = {
  storeName: string;
  storePhone: string;
  whatsappNumber: string;
  supportEmail: string;
  minOrderValue: number;
  freeDeliveryThreshold: number;
  defaultDeliveryFee: number;
  taxPercent: number;
  openingTime: string;
  closingTime: string;
  codEnabled: boolean;
  notificationsEnabled: boolean;
  announcement: string;
};

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "Sabjiwala",
  storePhone: "+91 7632 932 591",
  whatsappNumber: "+91 7632 932 591",
  supportEmail: "mukulgupta763293@gmail.com",
  minOrderValue: 99,
  freeDeliveryThreshold: 499,
  defaultDeliveryFee: 29,
  taxPercent: 5,
  openingTime: "06:00",
  closingTime: "22:30",
  codEnabled: true,
  notificationsEnabled: true,
  announcement: "Free delivery above ₹499 • Farm fresh cuts delivered in 45 minutes",
};

export async function getStoreSettings(): Promise<StoreSettings> {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(inArray(settingsTable.key, ["store"]));
  const stored = rows[0]?.value as Partial<StoreSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function updateStoreSettings(patch: Partial<StoreSettings>): Promise<StoreSettings> {
  const current = await getStoreSettings();
  const next = { ...current, ...patch };
  await db
    .insert(settingsTable)
    .values({ key: "store", value: next })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value: next, updatedAt: new Date() },
    });
  return next;
}
