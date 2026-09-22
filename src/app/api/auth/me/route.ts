import { ok, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getCartCount } from "@/server/cart";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await getCurrentUser();
  if (!user) return ok({ user: null, cartCount: 0 });
  let cartCount = 0;
  try {
    cartCount = await getCartCount();
  } catch {
    cartCount = 0;
  }
  return ok({ user, cartCount });
});
