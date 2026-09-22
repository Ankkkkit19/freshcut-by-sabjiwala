
import { createHash } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  addresses,
  orders,
  productVariants,
  products,
  users,
  whatsappLinkTokens,
  whatsappMessages,
  whatsappPendingActions,
  whatsappSessions,
  type OrderStatus,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { formatINR, formatQty, normalizePhone, toNum } from "@/lib/utils";
import { findLinkedUserByPhone, linkIdentity, sendWhatsAppText } from "@/lib/whatsapp";
import { addToCart, clearCart, getCartQuote, getOrCreateWhatsAppCart, removeCartItem } from "@/server/cart";
import { findProductByTerm } from "@/server/catalog";
import { adjustStock, listLowStock } from "@/server/inventory";
import { createOrder, getOrderDetail, listUserOrders, updateOrderStatus } from "@/server/orders";
import { getStoreSettings } from "@/server/settings";
import { AppError } from "@/lib/api";

const PENDING_TTL_MINUTES = 10;

export function hashLinkCode(code: string) {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

export function generateLinkCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `FC${out}`;
}

type Session = typeof whatsappSessions.$inferSelect;
type SessionContext = {
  candidates?: { productId: number; name: string; options: { id: number; label: string; price: number }[] }[];
  attempts?: number;
  blockedUntil?: number;
  pendingQuantity?: number;
};

async function getSession(phone: string): Promise<Session> {
  const rows = await db.select().from(whatsappSessions).where(eq(whatsappSessions.phone, phone)).limit(1);
  if (rows[0]) return rows[0];
  const created = await db.insert(whatsappSessions).values({ phone }).returning();
  return created[0]!;
}

async function updateSession(
  phone: string,
  patch: { state?: string; context?: SessionContext },
) {
  await db
    .update(whatsappSessions)
    .set({ ...patch, lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(whatsappSessions.phone, phone));
}

async function createPendingAction(input: {
  phone: string;
  userId: number | null;
  action: string;
  payload: Record<string, unknown>;
  summary: string;
}) {
  const expiresAt = new Date(Date.now() + PENDING_TTL_MINUTES * 60 * 1000);
  // Only one live action per phone - a new request replaces the old one.
  await db
    .delete(whatsappPendingActions)
    .where(
      and(
        eq(whatsappPendingActions.phone, input.phone),
        isNull(whatsappPendingActions.confirmedAt),
        isNull(whatsappPendingActions.cancelledAt),
        isNull(whatsappPendingActions.executedAt),
      ),
    );
  const created = await db.insert(whatsappPendingActions).values({ ...input, expiresAt }).returning();
  return created[0]!;
}

const HELP_CUSTOMER = `🥬 *FreshCut on WhatsApp*

Just type what you need, for example:
• _2 kg potato_ or _500 g tomato_
• _1 packet coriander_
• _show cart_ • _remove potato_ • _clear cart_
• _checkout_ • _track SW10001*
• _offers_ • _help_

We use the same cart as the website, so prices and stock always match.`;

const HELP_ADMIN = `🛠️ *FreshCut admin console*

• _order SW10001_ – order details
• _status SW10001 preparing_ – update status
• _stock potato 1kg +20_ – adjust stock
• _price potato 1kg 50_ – update price
• _report today_ – sales summary
• _low stock_ – items to restock
• _CONFIRM_ / _CANCEL_ – confirm a pending action`;

const STATUS_WORDS: Record<string, OrderStatus> = {
  preparing: "PREPARING",
  packed: "PACKED",
  out: "OUT_FOR_DELIVERY",
  ofd: "OUT_FOR_DELIVERY",
  delivered: "DELIVERED",
  cancelled: "CANCELLED",
  cancel: "CANCELLED",
  confirmed: "CONFIRMED",
};

type VariantLike = { id: number; label: string; price: number; stock: number; isDefault?: boolean };

const UNIT_ALIASES: Record<string, string> = {
  kg: "kg",
  kgs: "kg",
  kilo: "kg",
  kilos: "kg",
  g: "g",
  gm: "g",
  gms: "g",
  gram: "g",
  grams: "g",
  pcs: "piece",
  piece: "piece",
  pieces: "piece",
  packet: "packet",
  packets: "packet",
  pkt: "packet",
  bunch: "bunch",
};

/** "potato 1 kg" -> { term: "potato", label: "1kg" } */
function splitRequestedLabel(head: string): { term: string; label?: string } {
  const spaced = head.match(
    /^(.*?)\s*(\d+(?:\.\d+)?)\s*(kg|kgs|kilo|g|gm|gms|gram|grams|pcs|piece|pieces|packet|packets|pkt|bunch)\s*$/i,
  );
  if (spaced?.[1]) {
    const unit = UNIT_ALIASES[spaced[3]!.toLowerCase()] ?? spaced[3]!.toLowerCase();
    return { term: spaced[1].trim(), label: `${spaced[2]}${unit}` };
  }
  const attached = head.match(/^(.*?)\s*(\d+(?:\.\d+)?)(kg|g|gm|gms)\s*$/i);
  if (attached?.[1]) {
    const unit = UNIT_ALIASES[attached[3]!.toLowerCase()] ?? attached[3]!.toLowerCase();
    return { term: attached[1].trim(), label: `${attached[2]}${unit}` };
  }
  return { term: head.trim() };
}

const normaliseLabel = (value: string) => value.toLowerCase().replace(/\s+/g, "");

/** Never guess: an explicit label must match a real variant, else we ask. */
function findVariantByLabel(variants: VariantLike[], label?: string): VariantLike | undefined {
  if (!label) return undefined;
  const wanted = normaliseLabel(label);
  return variants.find((variant) => normaliseLabel(variant.label) === wanted);
}

/** Very small NLU: "<qty> <unit> <product term>" with Indian aliases. */
function parseQuantityRequest(text: string) {
  const match = text
    .trim()
    .toLowerCase()
    .match(
      /^(\d+(?:\.\d+)?)\s*(kg|kgs|kilo|kilos|g|gm|gms|gram|grams|packet|packets|pkt|pcs|piece|pieces|bunch)?\s+(.*)$/,
    );
  if (!match) return null;
  const quantity = Number(match[1]);
  const rawUnit = (match[2] ?? "").toLowerCase();
  const term = match[3].trim();
  const unit = ["kg", "kgs", "kilo", "kilos"].includes(rawUnit)
    ? "kg"
    : ["g", "gm", "gms", "gram", "grams"].includes(rawUnit)
      ? "g"
      : ["packet", "packets", "pkt"].includes(rawUnit)
        ? "packet"
        : ["pcs", "piece", "pieces"].includes(rawUnit)
          ? "piece"
          : rawUnit === "bunch"
            ? "bunch"
            : "";
  return { quantity, unit, term };
}

async function reply(phone: string, body: string, dedupeKey?: string) {
  await sendWhatsAppText(phone, body, { dedupeKey });
}

/* --------------------------------------------------------------- linking */

async function handleLinkCommand(phone: string, code: string, session: Session): Promise<string> {
  const context = (session.context ?? {}) as SessionContext;
  if (context.blockedUntil && context.blockedUntil > Date.now()) {
    return "⛔ Too many incorrect link attempts. Please try again in 15 minutes.";
  }
  const rows = await db
    .select()
    .from(whatsappLinkTokens)
    .where(
      and(
        eq(whatsappLinkTokens.tokenHash, hashLinkCode(code)),
        isNull(whatsappLinkTokens.usedAt),
        gt(whatsappLinkTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const token = rows[0];
  if (!token || token.attempts >= token.maxAttempts) {
    const attempts = (context.attempts ?? 0) + 1;
    await updateSession(phone, {
      context: {
        ...context,
        attempts,
        blockedUntil: attempts >= 5 ? Date.now() + 15 * 60 * 1000 : undefined,
      },
    });
    return "❌ That link code is invalid or expired. Generate a fresh code from your FreshCut profile.";
  }

  const result = await linkIdentity(phone, token.userId);
  if (!result.ok) return `❌ ${result.error}`;

  await db
    .update(whatsappLinkTokens)
    .set({ usedAt: new Date(), phone })
    .where(eq(whatsappLinkTokens.id, token.id));
  await db
    .update(whatsappSessions)
    .set({ userId: token.userId, state: "IDLE", context: {}, updatedAt: new Date() })
    .where(eq(whatsappSessions.phone, phone));
  await db
    .update(whatsappPendingActions)
    .set({ userId: token.userId })
    .where(eq(whatsappPendingActions.phone, phone));

  const user = await db.select().from(users).where(eq(users.id, token.userId)).limit(1);
  await recordAudit({
    actorUserId: token.userId,
    actorLabel: phone,
    action: "WHATSAPP_LINKED",
    resource: "whatsapp_identity",
    resourceId: phone,
    newValue: { phone },
    source: "WHATSAPP",
  });
  const isAdmin = user[0]?.role === "ADMIN";
  return `✅ Linked! Hi ${user[0]?.name ?? "there"}, your WhatsApp is now connected to your FreshCut account.${
    isAdmin ? "\n\nYou have *admin* access here:\n" + HELP_ADMIN : "\n\n" + HELP_CUSTOMER
  }`;
}

/* --------------------------------------------------------------- customer */

async function handleCartAdd(phone: string, userId: number | null, text: string): Promise<string> {
  const parsed = parseQuantityRequest(text);
  if (!parsed) return HELP_CUSTOMER;
  const product = await findProductByTerm(parsed.term);
  if (!product) {
    return `😕 I couldn't find *${parsed.term}* in our catalogue.\nTry _2 kg aloo_, _1 kg tamatar_ or _500 g palak_.`;
  }
  const session = await getSession(phone);
  const context = (session.context ?? {}) as SessionContext;

  // Resolution state: if we previously asked which variant to pick, take the number.
  if (session.state === "PICK_VARIANT" && /^\d+$/.test(text.trim()) && context.candidates?.length) {
    const candidate = context.candidates[0]!;
    const choice = candidate.options[Number(text.trim()) - 1];
    if (!choice) return "Please reply with one of the option numbers listed above.";
    const cart = await getOrCreateWhatsAppCart(phone, userId);
    await addToCart({
      variantId: choice.id,
      quantity: context.pendingQuantity ?? 1,
      cartId: cart.cartId,
    });
    await updateSession(phone, { state: "IDLE", context: {} });
    return `✅ ${candidate.name} ${choice.label} added to your cart.\nReply *show cart* to review.`;
  }

  // Explicit variant selection: match "2 kg" / "500 g" against real variant labels.
  const matchedVariant = parsed.unit
    ? findVariantByLabel(product.variants, `${parsed.quantity}${parsed.unit}`)
    : undefined;

  // quantity in grams when the variant is priced per 500g/250g pack
  let quantity = parsed.quantity;
  if (parsed.unit === "g" && matchedVariant) quantity = parsed.quantity;
  if (parsed.unit === "" && product.variants.length === 1) {
    quantity = parsed.quantity;
  }

  const chosen = matchedVariant ?? (product.variants.length === 1 ? product.variants[0] : undefined);

  if (!chosen) {
    const options = product.variants.slice(0, 9);
    await updateSession(phone, {
      state: "PICK_VARIANT",
      context: {
        candidates: [
          {
            productId: product.id,
            name: product.name,
            options: options.map((v) => ({ id: v.id, label: v.label, price: v.price })),
          },
        ],
        pendingQuantity: quantity,
      },
    });
    const list = options
      .map((v, i) => `${i + 1}. ${v.label} — ${formatINR(v.price)}${v.stock <= 0 ? " (out of stock)" : ""}`)
      .join("\n");
    return `Which pack size of *${product.name}* would you like?\n${list}\n\nReply with the option number.`;
  }

  if (chosen.stock <= 0) {
    return `😔 *${product.name} ${chosen.label}* is out of stock right now. Try another pack size or check back later.`;
  }

  const cart = await getOrCreateWhatsAppCart(phone, userId);
  await addToCart({ variantId: chosen.id, quantity, cartId: cart.cartId });
  await updateSession(phone, { state: "IDLE", context: {} });
  const quote = await getCartQuote({ cartId: cart.cartId, userId });
  return `✅ *${product.name} ${chosen.label} × ${formatQty(quantity)}* added.\nCart total: ${formatINR(
    quote.subtotal,
  )} • ${quote.itemCount} item(s).\nReply *show cart* to review or *checkout* to order.`;
}

async function renderCart(phone: string, userId: number | null) {
  const cart = await getOrCreateWhatsAppCart(phone, userId);
  const quote = await getCartQuote({ cartId: cart.cartId, userId });
  if (quote.itemCount === 0) {
    return "🛒 Your cart is empty.\nTry _2 kg potato_ or _1 kg tamatar_ to start.";
  }
  const lines = quote.lines
    .map((l) => `${l.productName} ${l.variantLabel} × ${formatQty(l.quantity)} — ${formatINR(l.lineTotal)}`)
    .join("\n");
  return `🛒 *Your Cart*\n${lines}\n\nSubtotal — ${formatINR(quote.subtotal)}\nDelivery — ${
    quote.deliveryFee === 0 ? "FREE" : formatINR(quote.deliveryFee)
  }\nTotal — ${formatINR(quote.total)}\n\nReply *checkout* to place the order.`;
}

async function handleCustomerCommand(
  phone: string,
  userId: number,
  text: string,
): Promise<string | null> {
  const t = text.trim().toLowerCase();

  if (t === "cart" || t === "show cart" || t === "my cart") return renderCart(phone, userId);
  if (t === "clear cart") {
    const cart = await getOrCreateWhatsAppCart(phone, userId);
    await clearCart(cart.cartId);
    return "🧺 Cart cleared.";
  }
  if (t.startsWith("remove ")) {
    const term = text.trim().slice(7);
    const cart = await getOrCreateWhatsAppCart(phone, userId);
    const quote = await getCartQuote({ cartId: cart.cartId, userId });
    const line = quote.lines.find((l) => l.productName.toLowerCase().includes(term.toLowerCase()));
    if (!line) return `I couldn't find *${term}* in your cart.`;
    await removeCartItem(line.cartItemId, cart.cartId);
    return `🗑️ Removed *${line.productName}* from your cart.`;
  }
  if (t === "checkout" || t === "order" || t === "place order") {
    return placeWhatsAppOrder(phone, userId);
  }
  if (t.startsWith("track ") || t.startsWith("order sw")) {
    const number = text.trim().split(/\s+/).pop()?.toUpperCase() ?? "";
    const detail = await getOrderDetail(number);
    if (!detail || detail.order.userId !== userId) return `I couldn't find order *${number}*.`;
    return `📦 *Order ${detail.order.orderNumber}*\nStatus: *${detail.order.status.replace(/_/g, " ")}*\nTotal: ${formatINR(
      detail.order.total,
    )}\nItems: ${detail.items.length}\n${
      detail.order.estimatedDeliveryAt
        ? `Expected by ${detail.order.estimatedDeliveryAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
        : ""
    }`;
  }
  if (t === "orders") {
    const list = await listUserOrders(userId, 5);
    if (list.length === 0) return "You have no orders yet. Reply *2 kg potato* to start your first order!";
    return `🧾 *Recent orders*\n${list
      .map((o) => `${o.orderNumber} — ${formatINR(o.total)} — ${o.status.replace(/_/g, " ")}`)
      .join("\n")}`;
  }
  return null;
}

async function placeWhatsAppOrder(phone: string, userId: number) {
  const cart = await getOrCreateWhatsAppCart(phone, userId);
  const quote = await getCartQuote({ cartId: cart.cartId, userId });
  if (quote.itemCount === 0) return "🛒 Your cart is empty. Add something first, e.g. _2 kg potato_.";

  const addressRows = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(desc(addresses.isDefault), desc(addresses.updatedAt))
    .limit(1);
  const address = addressRows[0];
  if (!address) {
    return `📍 You don't have a saved delivery address yet.\nAdd one on the website (Profile → Addresses) and reply *checkout* again.`;
  }

  const settings = await getStoreSettings();
  if (!settings.codEnabled) {
    return "💳 Cash on delivery is currently disabled. Please complete checkout on the website.";
  }

  try {
    const order = await createOrder({
      userId,
      cartId: cart.cartId,
      addressId: address.id,
      couponCode: quote.coupon?.code ?? null,
      paymentMethod: "COD",
      deliverySlot: "WhatsApp order • next slot",
      source: "WHATSAPP",
    });
    return `🎉 *Order ${order.orderNumber} placed!*\nTotal: ${formatINR(order.total)} (COD)\nDelivering to: ${address.line1}, ${address.area}\nWe'll notify you at every step.`;
  } catch (error) {
    if (error instanceof AppError) return `⚠️ ${error.message}`;
    throw error;
  }
}

/* --------------------------------------------------------------- admin */

async function resolveAdmin(phone: string) {
  const linked = await findLinkedUserByPhone(phone);
  if (!linked || linked.role !== "ADMIN") return null;
  return linked;
}

async function handleAdminCommand(
  phone: string,
  adminUserId: number,
  name: string,
  text: string,
): Promise<string | null> {
  const t = text.trim().toLowerCase();

  if (t === "confirm" || t === "cancel") {
    const rows = await db
      .select()
      .from(whatsappPendingActions)
      .where(
        and(
          eq(whatsappPendingActions.phone, phone),
          isNull(whatsappPendingActions.executedAt),
          isNull(whatsappPendingActions.cancelledAt),
          isNull(whatsappPendingActions.confirmedAt),
        ),
      )
      .orderBy(desc(whatsappPendingActions.createdAt))
      .limit(1);
    const pending = rows[0];
    if (!pending) return "There is no pending action to confirm.";
    if (pending.expiresAt < new Date()) {
      await db
        .update(whatsappPendingActions)
        .set({ cancelledAt: new Date(), resultText: "expired" })
        .where(eq(whatsappPendingActions.id, pending.id));
      return "⌛ That action expired. Please send the command again.";
    }
    if (t === "cancel") {
      await db
        .update(whatsappPendingActions)
        .set({ cancelledAt: new Date(), resultText: "cancelled by admin" })
        .where(eq(whatsappPendingActions.id, pending.id));
      return "❎ Action cancelled.";
    }
    const result = await executePendingAction(pending, adminUserId, name);
    return result;
  }

  // order SW10001
  const orderMatch = text.trim().match(/^order\s+(sw\d+)$/i);
  if (orderMatch) {
    const detail = await getOrderDetail(orderMatch[1]!.toUpperCase());
    if (!detail) return `No order found for *${orderMatch[1]}*.`;
    const items = detail.items
      .map((i) => `• ${i.productName} ${i.variantLabel} × ${formatQty(i.quantity)} — ${formatINR(i.lineTotal)}`)
      .join("\n");
    return `🧾 *${detail.order.orderNumber}* • ${detail.order.status.replace(/_/g, " ")}\n${detail.customerName} (${detail.customerEmail})\n${items}\n\nTotal: ${formatINR(detail.order.total)} • ${
      detail.order.paymentMethod
    }\nAddress: ${detail.order.deliveryAddress.line1}, ${detail.order.deliveryAddress.area}, ${detail.order.deliveryAddress.pincode}`;
  }

  // status SW10001 preparing
  const statusMatch = text.trim().match(/^status\s+(sw\d+)\s+([a-z_ ]+)$/i);
  if (statusMatch) {
    const orderNumber = statusMatch[1]!.toUpperCase();
    const word = statusMatch[2]!.trim().toLowerCase().replace(/\s+/g, "_");
    const status = STATUS_WORDS[word.replace(/_/g, "")] ?? STATUS_WORDS[word];
    if (!status) return `Unknown status *${statusMatch[2]}*. Use: preparing, packed, out for delivery, delivered, cancelled.`;
    const pending = await createPendingAction({
      phone,
      userId: adminUserId,
      action: "ORDER_STATUS",
      payload: { orderNumber, status },
      summary: `Change order *${orderNumber}* status to *${status.replace(/_/g, " ")}*?`,
    });
    return `Confirm status update:\n${pending.summary}\n\nReply *CONFIRM* (expires in ${PENDING_TTL_MINUTES} min) or *CANCEL*.`;
  }

  // stock potato 1kg +20 | stock potato 1 kg +20 wastage
  const stockMatch = text.trim().match(/^stock\s+(.+?)\s*([+-]\d+(?:\.\d+)?)\s*(.*)$/i);
  if (stockMatch) {
    const { term, label } = splitRequestedLabel(stockMatch[1]!.trim());
    const delta = Number(stockMatch[2]);
    const reason = stockMatch[3]?.trim() ?? "";
    const product = await findProductByTerm(term);
    if (!product) return `No product matched *${term}*.`;
    const variant =
      findVariantByLabel(product.variants, label) ??
      (label ? undefined : (product.variants.find((v) => v.isDefault) ?? product.variants[0]));
    if (!variant) {
      return label
        ? `*${product.name}* has no *${label}* pack. Available: ${product.variants
            .map((v) => v.label)
            .join(", ")}`
        : `*${product.name}* has no variants configured.`;
    }
    const type = /wastage|waste/.test(reason.toLowerCase())
      ? "WASTAGE"
      : /damage/.test(reason.toLowerCase())
        ? "DAMAGED"
        : "ADJUSTMENT";
    const pending = await createPendingAction({
      phone,
      userId: adminUserId,
      action: "STOCK_ADJUST",
      payload: { variantId: variant.id, delta, type, reason: reason || "WhatsApp stock update" },
      summary: `${product.name} ${variant.label}: stock ${variant.stock} → ${variant.stock + delta} (${type.toLowerCase()})`,
    });
    return `Confirm stock update:\n${pending.summary}\n\nReply *CONFIRM* or *CANCEL*.`;
  }

  // price potato 50 | price potato 1 kg 50
  const priceMatch = text.trim().match(/^price\s+(.+?)\s*(\d+(?:\.\d+)?)\s*$/i);
  if (priceMatch) {
    const { term, label } = splitRequestedLabel(priceMatch[1]!.trim());
    const price = Number(priceMatch[2]);
    const product = await findProductByTerm(term);
    if (!product) return `No product matched *${term}*.`;
    const variant =
      findVariantByLabel(product.variants, label) ??
      (label ? undefined : (product.variants.find((v) => v.isDefault) ?? product.variants[0]));
    if (!variant) {
      return label
        ? `*${product.name}* has no *${label}* pack. Available: ${product.variants
            .map((v) => v.label)
            .join(", ")}`
        : `*${product.name}* has no variants configured.`;
    }
    const pending = await createPendingAction({
      phone,
      userId: adminUserId,
      action: "PRICE_UPDATE",
      payload: { variantId: variant.id, price },
      summary: `${product.name}\n${variant.label}\n${formatINR(variant.price)} → ${formatINR(price)}`,
    });
    return `Confirm price update:\n${pending.summary}\n\nReply *CONFIRM* or *CANCEL*.`;
  }

  if (t === "report today" || t === "report" || t === "today") {
    const stats = await db.execute<{ orders: string; revenue: string; pending: string }>(sql`
      SELECT COUNT(*)::text AS orders,
             COALESCE(SUM(total), 0)::text AS revenue,
             COUNT(*) FILTER (WHERE status NOT IN ('DELIVERED','CANCELLED'))::text AS pending
      FROM orders WHERE created_at >= date_trunc('day', now())
    `);
    const row = stats.rows[0];
    return `📊 *Today @ ${name}'s store*\nOrders: ${row?.orders ?? 0}\nRevenue: ${formatINR(row?.revenue ?? 0)}\nOpen orders: ${row?.pending ?? 0}`;
  }

  if (t === "low stock") {
    const items = await listLowStock(8);
    if (items.length === 0) return "✅ No low-stock items. Everything is well stocked.";
    return `⚠️ *Low stock*\n${items
      .map((i) => `• ${i.productName} ${i.label}: ${formatQty(i.stock)} ${i.unit.toLowerCase()}`)
      .join("\n")}\n\nUpdate with e.g. _stock potato 1kg +20_`;
  }

  return null;
}

async function executePendingAction(
  pending: typeof whatsappPendingActions.$inferSelect,
  adminUserId: number,
  name: string,
): Promise<string> {
  const payload = pending.payload as Record<string, unknown>;
  try {
    if (pending.action === "ORDER_STATUS") {
      const orderNumber = String(payload.orderNumber);
      const status = payload.status as OrderStatus;
      const result = await updateOrderStatus({
        orderNumber,
        status,
        actor: { id: adminUserId, label: name },
        source: "WHATSAPP",
      });
      await db
        .update(whatsappPendingActions)
        .set({ confirmedAt: new Date(), executedAt: new Date(), resultText: `status=${status}` })
        .where(eq(whatsappPendingActions.id, pending.id));
      return `✅ *${orderNumber}* is now *${result.order.status.replace(/_/g, " ")}*. Customer notified.`;
    }

    if (pending.action === "STOCK_ADJUST") {
      const variantId = Number(payload.variantId);
      const result = await adjustStock({
        variantId,
        type: payload.type as "ADJUSTMENT" | "WASTAGE" | "DAMAGED",
        quantity: Number(payload.delta),
        reason: String(payload.reason ?? "WhatsApp update"),
        actorUserId: adminUserId,
        source: "WHATSAPP",
      });
      await recordAudit({
        actorUserId: adminUserId,
        actorLabel: `whatsapp:${name}`,
        action: "STOCK_UPDATED",
        resource: "product_variant",
        resourceId: variantId,
        newValue: { balanceAfter: result.balanceAfter, delta: result.delta },
        source: "WHATSAPP",
      });
      await db
        .update(whatsappPendingActions)
        .set({ confirmedAt: new Date(), executedAt: new Date(), resultText: `stock=${result.balanceAfter}` })
        .where(eq(whatsappPendingActions.id, pending.id));
      return `✅ Stock updated. New balance: *${formatQty(result.balanceAfter)}*`;
    }

    if (pending.action === "PRICE_UPDATE") {
      const variantId = Number(payload.variantId);
      const price = Number(payload.price);
      const before = await db
        .select({ price: productVariants.price, label: productVariants.label })
        .from(productVariants)
        .where(eq(productVariants.id, variantId))
        .limit(1);
      await db
        .update(productVariants)
        .set({ price: String(price), updatedAt: new Date() })
        .where(eq(productVariants.id, variantId));
      await recordAudit({
        actorUserId: adminUserId,
        actorLabel: `whatsapp:${name}`,
        action: "PRICE_UPDATED",
        resource: "product_variant",
        resourceId: variantId,
        previousValue: { price: before[0]?.price },
        newValue: { price },
        source: "WHATSAPP",
      });
      await db
        .update(whatsappPendingActions)
        .set({ confirmedAt: new Date(), executedAt: new Date(), resultText: `price=${price}` })
        .where(eq(whatsappPendingActions.id, pending.id));
      return `✅ Price for ${before[0]?.label ?? "variant"} updated: ${formatINR(before[0]?.price)} → *${formatINR(price)}*`;
    }

    await db
      .update(whatsappPendingActions)
      .set({ confirmedAt: new Date(), executedAt: new Date(), resultText: "unsupported action" })
      .where(eq(whatsappPendingActions.id, pending.id));
    return "⚠️ This action is not supported.";
  } catch (error) {
    await db
      .update(whatsappPendingActions)
      .set({
        confirmedAt: new Date(),
        executedAt: new Date(),
        resultText: error instanceof Error ? error.message : "failed",
      })
      .where(eq(whatsappPendingActions.id, pending.id));
    return `⚠️ ${error instanceof AppError ? error.message : "Action failed. Nothing was changed."}`;
  }
}

/* --------------------------------------------------------------- entry point */

/**
 * Handles one inbound message. Authorization always comes from the linked
 * database identity - never from the message text.
 */
export async function processIncomingText(phoneRaw: string, text: string): Promise<string> {
  const phone = normalizePhone(phoneRaw) ?? phoneRaw;
  const session = await getSession(phone);
  const linked = await findLinkedUserByPhone(phone);

  if (/^link\s+/i.test(text)) {
    return handleLinkCommand(phone, text.trim().split(/\s+/)[1]!, session);
  }

  if (!linked) {
    return `👋 Welcome to *FreshCut* on WhatsApp!\n\nTo order and track deliveries here, link your account:\n1. Open ${process.env.NEXT_PUBLIC_APP_URL ?? "the FreshCut website"} → Profile\n2. Tap *Link WhatsApp*\n3. Send the 8-character code here as _link FCXXXXXX_\n\nYou can also browse and order on the website.`;
  }

  const isAdmin = linked.role === "ADMIN";
  const lower = text.trim().toLowerCase();

  if (lower === "help" || lower === "hi" || lower === "hello" || lower === "menu") {
    return isAdmin ? `${HELP_ADMIN}\n\n${HELP_CUSTOMER}` : HELP_CUSTOMER;
  }

  if (isAdmin) {
    const adminReply = await handleAdminCommand(phone, linked.userId, linked.name, text);
    if (adminReply) return adminReply;
  }

  const customerReply = await handleCustomerCommand(phone, linked.userId, text);
  if (customerReply) return customerReply;

  const addReply = await handleCartAdd(phone, linked.userId, text);
  return addReply;
}

export async function handleIncomingMessage(options: {
  waMessageId: string;
  phone: string;
  text: string;
}): Promise<string> {
  const replyText = await processIncomingText(options.phone, options.text);
  await reply(options.phone, replyText, options.waMessageId);
  return replyText;
}

export async function expirePendingActions() {
  const expired = await db
    .delete(whatsappPendingActions)
    .where(
      and(
        isNull(whatsappPendingActions.executedAt),
        isNull(whatsappPendingActions.cancelledAt),
        sql`${whatsappPendingActions.expiresAt} < now()`,
      ),
    )
    .returning({ id: whatsappPendingActions.id });
  return expired.length;
}

export async function listWhatsAppConsole() {
  const [messages, pending, identities] = await Promise.all([
    db.select().from(whatsappMessages).orderBy(desc(whatsappMessages.createdAt)).limit(40),
    db
      .select()
      .from(whatsappPendingActions)
      .orderBy(desc(whatsappPendingActions.createdAt))
      .limit(10),
    db
      .select({
        phone: whatsappLinkTokens.phone,
        userId: whatsappLinkTokens.userId,
        name: users.name,
        role: users.role,
        expiresAt: whatsappLinkTokens.expiresAt,
        usedAt: whatsappLinkTokens.usedAt,
      })
      .from(whatsappLinkTokens)
      .innerJoin(users, eq(users.id, whatsappLinkTokens.userId))
      .orderBy(desc(whatsappLinkTokens.createdAt))
      .limit(10),
  ]);
  return { messages, pending, identities };
}

export async function listProductsForAdminPicker() {
  return db
    .select({
      id: products.id,
      name: products.name,
      variants: sql<{ id: number; label: string; price: string; stock: string }[]>`(
        SELECT COALESCE(json_agg(json_build_object('id', v.id, 'label', v.label, 'price', v.price, 'stock', v.stock) ORDER BY v.sort_order), '[]'::json)
        FROM product_variants v WHERE v.product_id = ${products.id}
      )`,
    })
    .from(products)
    .orderBy(products.name)
    .limit(200);
}

export async function countWhatsAppMessages() {
  const rows = await db
    .select({ direction: whatsappMessages.direction, count: sql<number>`count(*)::int` })
    .from(whatsappMessages)
    .groupBy(whatsappMessages.direction);
  return rows;
}

export async function latestOrdersForBot(limit = 5) {
  return db
    .select({ orderNumber: orders.orderNumber, total: orders.total, status: orders.status })
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export { toNum };
