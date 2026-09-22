import { ok, parseBody, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { couponValidateSchema } from "@/lib/validation";
import { getCartQuote, getOrCreateCart } from "@/server/cart";

export const dynamic = "force-dynamic";

export const POST = route(async (request) => {
  const body = await parseBody(request, couponValidateSchema);
  const user = await getCurrentUser();
  const cart = await getOrCreateCart();
  const quote = await getCartQuote({
    cartId: cart.cartId,
    userId: user?.id ?? null,
    couponCode: body.code,
  });
  return ok({
    coupon: quote.coupon,
    discount: quote.discount,
    message: quote.couponMessage,
    total: quote.total,
  });
});
