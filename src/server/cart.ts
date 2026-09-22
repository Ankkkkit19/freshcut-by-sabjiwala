
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, carts, productVariants } from "@/db/schema";
import { AppError } from "@/lib/api";
import { getCurrentUser, getGuestToken } from "@/lib/auth";
import { toNum } from "@/lib/utils";
import { buildQuote, getRawCartRows, type Quote } from "@/server/pricing";

export type ResolvedCart = {
  cartId: number;
  userId: number | null;
  guestToken: string | null;
  whatsappPhone: string | null;
};

async function findOrCreateByUser(userId: number, guestToken: string | null): Promise<ResolvedCart> {
  const existing = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
  if (existing[0]) {
    const cart = existing[0];
    if (guestToken) await mergeGuestCart(cart.id, guestToken);
    return { cartId: cart.id, userId, guestToken: null, whatsappPhone: cart.whatsappPhone };
  }
  // Adopt a guest cart if the same browser already had one, otherwise create fresh.
  if (guestToken) {
    const guest = await db.select().from(carts).where(eq(carts.guestToken, guestToken)).limit(1);
    if (guest[0]) {
      const adopted = await db
        .update(carts)
        .set({ userId, guestToken: null, updatedAt: new Date() })
        .where(eq(carts.id, guest[0].id))
        .returning();
      const cart = adopted[0]!;
      return { cartId: cart.id, userId, guestToken: null, whatsappPhone: cart.whatsappPhone };
    }
  }
  const created = await db.insert(carts).values({ userId }).returning();
  const cart = created[0]!;
  return { cartId: cart.id, userId, guestToken: null, whatsappPhone: null };
}

/** Move guest cart lines into the signed-in cart (used on login). */
export async function mergeGuestCart(targetCartId: number, guestToken: string) {
  const guestRows = await db.select().from(carts).where(eq(carts.guestToken, guestToken)).limit(1);
  const guest = guestRows[0];
  if (!guest || guest.id === targetCartId) return;
  const items = await db.select().from(cartItems).where(eq(cartItems.cartId, guest.id));
  for (const item of items) {
    await db
      .insert(cartItems)
      .values({
        cartId: targetCartId,
        variantId: item.variantId,
        quantity: item.quantity,
        preparation: item.preparation,
      })
      .onConflictDoUpdate({
        target: [cartItems.cartId, cartItems.variantId],
        set: { quantity: sql`${cartItems.quantity} + ${item.quantity}`, updatedAt: new Date() },
      });
  }
  await db.delete(carts).where(eq(carts.id, guest.id));
}

/**
 * Every cart surface (web + WhatsApp) resolves to one database cart.
 * Signed-in users get their own cart; guests get a cookie-scoped cart.
 */
export async function getOrCreateCart(opts: { create?: boolean } = {}): Promise<ResolvedCart> {
  const user = await getCurrentUser();
  const guestToken = user ? await getGuestToken(false) : await getGuestToken(opts.create ?? false);
  if (user) return findOrCreateByUser(user.id, opts.create ? (await getGuestToken(true)) : guestToken);
  if (!guestToken) {
    throw new AppError("UNAUTHENTICATED", "Please sign in to start adding items to your cart.");
  }
  const existing = await db.select().from(carts).where(eq(carts.guestToken, guestToken)).limit(1);
  if (existing[0]) {
    return {
      cartId: existing[0].id,
      userId: null,
      guestToken,
      whatsappPhone: existing[0].whatsappPhone,
    };
  }
  if (!opts.create) {
    return { cartId: 0, userId: null, guestToken, whatsappPhone: null };
  }
  const created = await db.insert(carts).values({ guestToken }).returning();
  return { cartId: created[0]!.id, userId: null, guestToken, whatsappPhone: null };
}

/** Cart bound to a verified WhatsApp phone number - same tables, same pricing. */
export async function getOrCreateWhatsAppCart(phone: string, userId: number | null) {
  if (userId) return findOrCreateByUser(userId, null);
  const existing = await db.select().from(carts).where(eq(carts.whatsappPhone, phone)).limit(1);
  if (existing[0]) {
    return {
      cartId: existing[0].id,
      userId: null,
      guestToken: null,
      whatsappPhone: phone,
    };
  }
  const created = await db.insert(carts).values({ whatsappPhone: phone }).returning();
  return { cartId: created[0]!.id, userId: null, guestToken: null, whatsappPhone: phone };
}

async function ensureCartRow(cartId: number): Promise<number> {
  if (cartId) return cartId;
  const cart = await getOrCreateCart({ create: true });
  return cart.cartId;
}

export async function addToCart(input: {
  variantId: number;
  quantity: number;
  preparation?: string | null;
  cartId?: number;
}) {
  const cartId = await ensureCartRow(input.cartId ?? 0);
  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.id, input.variantId))
    .limit(1);
  const variant = variants[0];
  if (!variant || !variant.isActive) {
    throw new AppError("PRODUCT_UNAVAILABLE", "This variant is not available right now.");
  }
  const available = toNum(variant.stock);
  const existing = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, input.variantId)))
    .limit(1);
  const current = existing[0] ? toNum(existing[0].quantity) : 0;
  const next = Math.round((current + input.quantity) * 1000) / 1000;
  if (available <= 0) {
    throw new AppError("INSUFFICIENT_STOCK", `Only ${available} available right now.`, {
      available,
    });
  }
  if (next > available) {
    throw new AppError(
      "INSUFFICIENT_STOCK",
      `Only ${available} ${variant.unit.toLowerCase()} of ${variant.label} in stock.`,
      { available },
    );
  }
  if (existing[0]) {
    await db
      .update(cartItems)
      .set({ quantity: String(next), updatedAt: new Date() })
      .where(eq(cartItems.id, existing[0].id));
  } else {
    await db.insert(cartItems).values({
      cartId,
      variantId: input.variantId,
      quantity: String(next),
      preparation: input.preparation || null,
    });
  }
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
  return { cartId, quantity: next };
}

export async function updateCartItem(input: { itemId: number; quantity: number; cartId?: number }) {
  const cart = input.cartId ? { cartId: input.cartId } : await getOrCreateCart();
  if (!cart.cartId) throw new AppError("NOT_FOUND", "Cart not found.");
  const rows = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.id, input.itemId), eq(cartItems.cartId, cart.cartId)))
    .limit(1);
  const item = rows[0];
  if (!item) throw new AppError("NOT_FOUND", "Cart item not found.");
  if (input.quantity <= 0) {
    await db.delete(cartItems).where(eq(cartItems.id, item.id));
    return { removed: true };
  }
  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.id, item.variantId))
    .limit(1);
  const available = toNum(variants[0]?.stock);
  if (input.quantity > available) {
    throw new AppError("INSUFFICIENT_STOCK", `Only ${available} available right now.`, {
      available,
    });
  }
  await db
    .update(cartItems)
    .set({ quantity: String(input.quantity), updatedAt: new Date() })
    .where(eq(cartItems.id, item.id));
  return { removed: false, quantity: input.quantity };
}

export async function removeCartItem(itemId: number, cartId?: number) {
  const cart = cartId ? { cartId } : await getOrCreateCart();
  if (!cart.cartId) return { removed: 0 };
  const deleted = await db
    .delete(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.cartId)))
    .returning({ id: cartItems.id });
  return { removed: deleted.length };
}

export async function clearCart(cartId: number) {
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
}

export async function getCartCount(): Promise<number> {
  const cart = await getOrCreateCart();
  if (!cart.cartId) return 0;
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cartItems)
    .where(eq(cartItems.cartId, cart.cartId));
  return toNum(rows[0]?.count);
}

/** Full server-priced cart used by /cart, checkout and WhatsApp. */
export async function getCartQuote(opts: {
  cartId: number;
  pincode?: string | null;
  area?: string | null;
  couponCode?: string | null;
  userId?: number | null;
}): Promise<Quote> {
  if (!opts.cartId) {
    return buildQuote({ rows: [], couponCode: null, userId: opts.userId ?? null });
  }
  const rows = await getRawCartRows(opts.cartId);
  return buildQuote({
    rows,
    pincode: opts.pincode ?? null,
    area: opts.area ?? null,
    couponCode: opts.couponCode ?? null,
    userId: opts.userId ?? null,
  });
}
