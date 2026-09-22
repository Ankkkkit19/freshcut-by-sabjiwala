import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { AppError, ok, parseBody, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { cartAddSchema, cartUpdateSchema } from "@/lib/validation";
import { addToCart, clearCart, getCartQuote, getOrCreateCart, updateCartItem } from "@/server/cart";
import { removeCartItem } from "@/server/cart";

export const dynamic = "force-dynamic";

async function resolvePincode(userId: number | null, addressId: string | null, pincode: string | null) {
  if (addressId && userId) {
    const rows = await db
      .select({ pincode: addresses.pincode, area: addresses.area })
      .from(addresses)
      .where(and(eq(addresses.id, Number(addressId)), eq(addresses.userId, userId)))
      .limit(1);
    if (rows[0]) return rows[0];
  }
  return pincode ? { pincode, area: null } : { pincode: null, area: null };
}

export const GET = route(async (request) => {
  const url = new URL(request.url);
  const user = await getCurrentUser();
  const cart = await getOrCreateCart();
  const location = await resolvePincode(
    user?.id ?? null,
    url.searchParams.get("addressId"),
    url.searchParams.get("pincode"),
  );
  const quote = await getCartQuote({
    cartId: cart.cartId,
    userId: user?.id ?? null,
    pincode: location.pincode,
    area: location.area,
    couponCode: url.searchParams.get("coupon"),
  });
  return ok({ cartId: cart.cartId, quote });
});

export const POST = route(async (request) => {
  const body = await parseBody(request, cartAddSchema);
  const result = await addToCart({
    variantId: body.variantId,
    quantity: body.quantity,
    preparation: body.preparation || null,
  });
  const user = await getCurrentUser();
  const quote = await getCartQuote({ cartId: result.cartId, userId: user?.id ?? null });
  return ok({ quantity: result.quantity, quote }, 201);
});

export const PATCH = route(async (request) => {
  const body = await parseBody(request, cartUpdateSchema);
  const cart = await getOrCreateCart({ create: true });
  await updateCartItem({ itemId: body.itemId, quantity: body.quantity, cartId: cart.cartId });
  const user = await getCurrentUser();
  const quote = await getCartQuote({ cartId: cart.cartId, userId: user?.id ?? null });
  return ok({ quote });
});

export const DELETE = route(async (request) => {
  const url = new URL(request.url);
  const itemId = url.searchParams.get("itemId");
  const cart = await getOrCreateCart();
  if (!cart.cartId) throw new AppError("NOT_FOUND", "Your cart is empty.");
  if (itemId) {
    await removeCartItem(Number(itemId), cart.cartId);
  } else {
    await clearCart(cart.cartId);
  }
  const user = await getCurrentUser();
  const quote = await getCartQuote({ cartId: cart.cartId, userId: user?.id ?? null });
  return ok({ quote });
});
