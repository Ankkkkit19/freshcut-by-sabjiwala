import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { AppError, ok, parseBody, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { checkoutSchema } from "@/lib/validation";
import { getCartQuote, getOrCreateCart } from "@/server/cart";
import { createOrder } from "@/server/orders";

export const dynamic = "force-dynamic";

/** Server-priced checkout summary. The client never sends amounts. */
export const GET = route(async (request) => {
  const user = await requireUser();
  const url = new URL(request.url);
  const addressId = url.searchParams.get("addressId");
  const cart = await getOrCreateCart();

  let pincode: string | null = null;
  let area: string | null = null;
  if (addressId) {
    const rows = await db
      .select({ pincode: addresses.pincode, area: addresses.area })
      .from(addresses)
      .where(and(eq(addresses.id, Number(addressId)), eq(addresses.userId, user.id)))
      .limit(1);
    if (!rows[0]) throw new AppError("NOT_FOUND", "Address not found on your account.");
    pincode = rows[0].pincode;
    area = rows[0].area;
  }

  const quote = await getCartQuote({
    cartId: cart.cartId,
    userId: user.id,
    pincode,
    area,
    couponCode: url.searchParams.get("coupon"),
  });
  return ok({ quote, user: { id: user.id, name: user.name, email: user.email, phone: user.phone } });
});

export const POST = route(async (request) => {
  const user = await requireUser();
  const body = await parseBody(request, checkoutSchema);
  const cart = await getOrCreateCart();
  const order = await createOrder({
    userId: user.id,
    cartId: cart.cartId,
    addressId: body.addressId,
    couponCode: body.couponCode || null,
    deliverySlot: body.deliverySlot || null,
    paymentMethod: body.paymentMethod,
    notes: body.notes || null,
    source: "WEB",
  });
  return ok(
    {
      order: {
        orderNumber: order.orderNumber,
        total: order.total,
        status: order.status,
        estimatedDeliveryAt: order.estimatedDeliveryAt,
      },
    },
    201,
  );
});
