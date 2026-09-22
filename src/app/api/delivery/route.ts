import { ok, route } from "@/lib/api";
import { resolveDeliveryZone } from "@/server/pricing";
import { getStoreSettings } from "@/server/settings";
import { toNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const url = new URL(request.url);
  const pincode = url.searchParams.get("pincode");
  const settings = await getStoreSettings();
  if (!pincode) {
    const { db } = await import("@/db");
    const { deliveryZones } = await import("@/db/schema");
    const { asc, eq } = await import("drizzle-orm");
    const zones = await db
      .select({
        pincode: deliveryZones.pincode,
        area: deliveryZones.area,
        city: deliveryZones.city,
        etaMinutes: deliveryZones.etaMinutes,
      })
      .from(deliveryZones)
      .where(eq(deliveryZones.isActive, true))
      .orderBy(asc(deliveryZones.pincode))
      .limit(12);
    return ok({ zones, settings: { minOrderValue: settings.minOrderValue } });
  }
  const zone = await resolveDeliveryZone(pincode);
  if (!zone) return ok({ available: false, pincode });
  return ok({
    available: true,
    zone: {
      id: zone.id,
      area: zone.area,
      city: zone.city,
      pincode: zone.pincode,
      deliveryFee: toNum(zone.deliveryFee),
      minOrderValue: toNum(zone.minOrderValue),
      freeDeliveryThreshold: toNum(zone.freeDeliveryThreshold),
      etaMinutes: zone.etaMinutes,
    },
  });
});
