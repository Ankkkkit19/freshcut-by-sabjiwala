
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  addresses,
  auditLogs,
  cartItems,
  carts,
  coupons,
  couponUsages,
  deliveryZones,
  orderItems,
  orders,
  productVariants,
  products,
  users,
  type OrderStatus,
} from "@/db/schema";
import { AppError } from "@/lib/api";
import { nextOrderNumber, recordAudit, type AuditSource } from "@/lib/audit";
import { toNum } from "@/lib/utils";
import { adjustStock } from "@/server/inventory";
import { enqueueOrderNotification } from "@/lib/whatsapp";
import { getStoreSettings } from "@/server/settings";

export type DeliveryAddressSnapshot = {
  fullName: string;
  phone: string;
  line1: string;
  street: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  type: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export type CreateOrderInput = {
  userId: number;
  cartId?: number;
  addressId: number;
  couponCode?: string | null;
  deliverySlot?: string | null;
  paymentMethod?: "COD" | "UPI" | "WHATSAPP";
  notes?: string | null;
  source?: "WEB" | "WHATSAPP";
};

/**
 * Authoritative order creation. The client only ever supplies ids and a coupon
 * code - every price, stock check, coupon rule, delivery fee and tax value is
 * resolved here from the database inside a single transaction.
 */
export async function createOrder(input: CreateOrderInput) {
  const settings = await getStoreSettings();
  const addressRows = await db
    .select()
    .from(addresses)
    .where(and(eq(addresses.id, input.addressId), eq(addresses.userId, input.userId)))
    .limit(1);
  const address = addressRows[0];
  if (!address) throw new AppError("NOT_FOUND", "Delivery address not found.");

  const cartRow = await resolveCartId(input.userId, input.cartId);
  if (!cartRow) throw new AppError("EMPTY_CART", "Your cart is empty.");

  const order = await db.transaction(async (tx) => {
    const lines = await tx
      .select({
        cartItemId: cartItems.id,
        quantity: cartItems.quantity,
        preparation: cartItems.preparation,
        variantId: productVariants.id,
        variantLabel: productVariants.label,
        unit: productVariants.unit,
        price: productVariants.price,
        mrp: productVariants.mrp,
        variantActive: productVariants.isActive,
        productId: products.id,
        productName: products.name,
        productSlug: products.slug,
        productActive: products.isActive,
        images: products.images,
        yieldRatio: productVariants.yieldRatio,
      })
      .from(cartItems)
      .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(eq(cartItems.cartId, cartRow))
      .orderBy(asc(cartItems.id));

    if (lines.length === 0) throw new AppError("EMPTY_CART", "Your cart is empty.");

    // Lock every variant row, then validate availability against live stock.
    const variantIds = lines.map((l) => l.variantId);
    const locked = await tx.execute<{ id: number; stock: string; price: string }>(
      sql`SELECT id, stock, price FROM product_variants WHERE id IN (${sql.join(
        variantIds.map((id) => sql`${id}`),
        sql`, `,
      )}) FOR UPDATE`,
    );
    const stockById = new Map(
      locked.rows.map((r) => [Number(r.id), { stock: toNum(r.stock), price: toNum(r.price) }]),
    );

    const orderLines = lines.map((line) => {
      const live = stockById.get(line.variantId);
      if (!line.productActive || !line.variantActive) {
        throw new AppError("PRODUCT_UNAVAILABLE", `${line.productName} is no longer available.`);
      }
      const available = live?.stock ?? 0;
      const quantity = toNum(line.quantity);
      if (quantity <= 0) throw new AppError("BAD_REQUEST", "Invalid quantity in cart.");
      if (available < quantity) {
        throw new AppError(
          "INSUFFICIENT_STOCK",
          `${line.productName} ${line.variantLabel} is currently out of stock.`,
          { available, requested: quantity },
        );
      }
      const unitPrice = round2(live?.price ?? toNum(line.price));
      return {
        variantId: line.variantId,
        quantity,
        unitPrice,
        unitMrp: line.mrp ? round2(toNum(line.mrp)) : null,
        lineTotal: round2(unitPrice * quantity),
        productName: line.productName,
        productSlug: line.productSlug,
        variantLabel: line.variantLabel,
        unit: line.unit,
        imageUrl: (line.images ?? [])[0] ?? null,
        preparation: line.preparation,
      };
    });

    const subtotal = round2(orderLines.reduce((s, l) => s + l.lineTotal, 0));

    // Delivery zone + coupon rules are re-checked server-side.
    const zoneRows = await tx
      .select()
      .from(deliveryZones)
      .where(and(eq(deliveryZones.pincode, address.pincode), eq(deliveryZones.isActive, true)));
    const zone =
      zoneRows.find((z) => z.area.toLowerCase() === address.area.toLowerCase()) ?? zoneRows[0] ?? null;
    if (!zone) {
      throw new AppError(
        "DELIVERY_UNAVAILABLE",
        `We do not deliver to ${address.pincode} yet. Please choose another address.`,
      );
    }
    const minOrder = toNum(zone.minOrderValue);
    if (subtotal < minOrder) {
      throw new AppError(
        "MIN_ORDER_NOT_MET",
        `Minimum order value for ${zone.area} is ₹${minOrder}.`,
      );
    }

    let discount = 0;
    let couponId: number | null = null;
    let couponCode: string | null = null;
    if (input.couponCode && input.couponCode.trim()) {
      const code = input.couponCode.trim().toUpperCase();
      const couponRows = await tx
        .select()
        .from(coupons)
        .where(sql`upper(${coupons.code}) = ${code}`)
        .limit(1);
      const coupon = couponRows[0];
      const now = new Date();
      if (
        !coupon ||
        !coupon.isActive ||
        (coupon.startsAt && coupon.startsAt > now) ||
        (coupon.expiresAt && coupon.expiresAt < now)
      ) {
        throw new AppError("COUPON_INVALID", `Coupon "${code}" is not valid.`);
      }
      if (subtotal < toNum(coupon.minOrderValue)) {
        throw new AppError(
          "COUPON_INVALID",
          `Coupon "${code}" needs a minimum order of ₹${toNum(coupon.minOrderValue)}.`,
        );
      }
      if (coupon.usageLimit != null) {
        const used = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(couponUsages)
          .where(eq(couponUsages.couponId, coupon.id));
        if (toNum(used[0]?.count) >= coupon.usageLimit) {
          throw new AppError("COUPON_INVALID", `Coupon "${code}" has reached its usage limit.`);
        }
      }
      const usedByUser = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(couponUsages)
        .where(and(eq(couponUsages.couponId, coupon.id), eq(couponUsages.userId, input.userId)));
      if (coupon.perUserLimit > 0 && toNum(usedByUser[0]?.count) >= coupon.perUserLimit) {
        throw new AppError("COUPON_INVALID", `You have already used coupon "${code}".`);
      }
      discount = coupon.type === "PERCENTAGE" ? round2((subtotal * toNum(coupon.value)) / 100) : round2(toNum(coupon.value));
      const maxDiscount = coupon.maxDiscount ? toNum(coupon.maxDiscount) : null;
      if (maxDiscount) discount = Math.min(discount, maxDiscount);
      discount = Math.min(discount, subtotal);
      if (discount <= 0) throw new AppError("COUPON_INVALID", `Coupon "${code}" gives no discount.`);
      couponId = coupon.id;
      couponCode = code;
    }

    const taxable = Math.max(0, subtotal - discount);
    const freeThreshold = toNum(zone.freeDeliveryThreshold);
    const deliveryFee = freeThreshold > 0 && taxable >= freeThreshold ? 0 : round2(toNum(zone.deliveryFee));
    const tax = round2((taxable * settings.taxPercent) / 100);
    const total = round2(taxable + deliveryFee + tax);

    const orderNumber = await nextOrderNumber();
    const estimatedDeliveryAt = new Date(Date.now() + zone.etaMinutes * 60 * 1000);

    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber,
        userId: input.userId,
        status: "CONFIRMED",
        subtotal: String(subtotal),
        discount: String(discount),
        deliveryFee: String(deliveryFee),
        tax: String(tax),
        total: String(total),
        couponCode,
        couponId,
        paymentMethod: input.paymentMethod ?? "COD",
        paymentStatus: "PENDING",
        deliveryZoneId: zone.id,
        deliverySlot: input.deliverySlot ?? `Within ${zone.etaMinutes} minutes`,
        deliveryAddress: {
          fullName: address.fullName,
          phone: address.phone,
          line1: address.line1,
          street: address.street ?? "",
          area: address.area,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          landmark: address.landmark ?? "",
          type: address.type,
        } satisfies DeliveryAddressSnapshot,
        source: input.source ?? "WEB",
        notes: input.notes ?? null,
        estimatedDeliveryAt,
      })
      .returning();

    const createdOrder = order!;

    await tx.insert(orderItems).values(
      orderLines.map((line) => ({
        orderId: createdOrder.id,
        variantId: line.variantId,
        productName: line.productName,
        productSlug: line.productSlug,
        variantLabel: line.variantLabel,
        unit: line.unit,
        imageUrl: line.imageUrl,
        preparation: line.preparation,
        quantity: String(line.quantity),
        unitPrice: String(line.unitPrice),
        unitMrp: line.unitMrp != null ? String(line.unitMrp) : null,
        lineTotal: String(line.lineTotal),
      })),
    );

    // Inventory deduction is atomic with the order (no overselling).
    for (const line of orderLines) {
      await adjustStock({
        variantId: line.variantId,
        type: "SOLD",
        quantity: line.quantity,
        reason: `Order ${orderNumber}`,
        orderId: createdOrder.id,
        actorUserId: input.userId,
        source: input.source === "WHATSAPP" ? "WHATSAPP" : "WEB",
        client: tx,
      });
    }

    if (couponId) {
      await tx.insert(couponUsages).values({
        couponId,
        userId: input.userId,
        orderId: createdOrder.id,
        discount: String(discount),
      });
    }

    await tx.delete(cartItems).where(eq(cartItems.cartId, cartRow));

    if (input.source === "WHATSAPP") {
      await recordAudit({
        actorUserId: input.userId,
        actorLabel: "whatsapp",
        action: "ORDER_CREATED_WHATSAPP",
        resource: "order",
        resourceId: orderNumber,
        newValue: { total, itemCount: orderLines.length },
        source: "WHATSAPP",
      });
    }

    return { ...createdOrder, totalValue: total };
  });

  // Notifications run after the commit: a provider failure can never roll back
  // or corrupt a placed order.
  await enqueueOrderNotification({
    orderId: order.id,
    orderNumber: order.orderNumber,
    userId: input.userId,
    type: "ORDER_CONFIRMED",
  }).catch(() => undefined);

  return order;
}

async function resolveCartId(userId: number, cartId?: number): Promise<number | null> {
  if (cartId) return cartId;
  const rows = await db
    .select({ id: carts.id })
    .from(carts)
    .where(eq(carts.userId, userId))
    .limit(1);
  return rows[0]?.id ?? null;
}

/* ------------------------------------------------------------ reads */

export async function listUserOrders(userId: number, limit = 50) {
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      total: orders.total,
      subtotal: orders.subtotal,
      discount: orders.discount,
      deliveryFee: orders.deliveryFee,
      tax: orders.tax,
      createdAt: orders.createdAt,
      estimatedDeliveryAt: orders.estimatedDeliveryAt,
      itemCount: sql<number>`(SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id = ${orders.id})`,
      previewImages: sql<string[]>`(
        SELECT COALESCE(json_agg(x.image_url) FILTER (WHERE x.image_url IS NOT NULL), '[]'::json)
        FROM (SELECT image_url FROM order_items WHERE order_id = ${orders.id} LIMIT 3) x
      )`,
    })
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
  return rows;
}

export async function getOrderDetail(orderNumber: string) {
  const rows = await db
    .select({
      order: orders,
      customerName: users.name,
      customerEmail: users.email,
      customerPhone: users.phone,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, row.order.id)).orderBy(asc(orderItems.id));
  const history = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      createdAt: auditLogs.createdAt,
      source: auditLogs.source,
      actorLabel: auditLogs.actorLabel,
      previousValue: auditLogs.previousValue,
      newValue: auditLogs.newValue,
    })
    .from(auditLogs)
    .where(and(eq(auditLogs.resource, "order"), eq(auditLogs.resourceId, orderNumber)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(20);
  return { ...row, items, history };
}

/* ------------------------------------------------------------ status updates */

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CONFIRMED: ["PREPARING", "PACKED", "CANCELLED"],
  PREPARING: ["PACKED", "OUT_FOR_DELIVERY", "CANCELLED"],
  PACKED: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export async function updateOrderStatus(input: {
  orderNumber: string;
  status: OrderStatus;
  actor: { id: number | null; label: string };
  source?: AuditSource;
  reason?: string | null;
}) {
  const rows = await db.select().from(orders).where(eq(orders.orderNumber, input.orderNumber)).limit(1);
  const order = rows[0];
  if (!order) throw new AppError("NOT_FOUND", `Order ${input.orderNumber} was not found.`);
  if (order.status === input.status) {
    return { order, unchanged: true };
  }
  const allowed = ALLOWED_TRANSITIONS[order.status];
  if (!allowed.includes(input.status)) {
    throw new AppError(
      "CONFLICT",
      `Order ${order.orderNumber} is ${order.status.toLowerCase().replace(/_/g, " ")} and cannot move to ${input.status.toLowerCase().replace(/_/g, " ")}.`,
    );
  }

  const updated = await db.transaction(async (tx) => {
    const patch: Partial<typeof orders.$inferInsert> = {
      status: input.status,
      updatedAt: new Date(),
    };
    if (input.status === "DELIVERED") {
      patch.deliveredAt = new Date();
      patch.paymentStatus = order.paymentMethod === "COD" ? "PAID" : order.paymentStatus;
    }
    if (input.status === "CANCELLED") {
      patch.cancelledAt = new Date();
      patch.cancelReason = input.reason ?? "Cancelled by store";
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      for (const item of items) {
        if (!item.variantId) continue;
        await adjustStock({
          variantId: item.variantId,
          type: "RETURN",
          quantity: toNum(item.quantity),
          reason: `Order ${order.orderNumber} cancelled - stock restored`,
          orderId: order.id,
          actorUserId: input.actor.id,
          source: input.source === "WHATSAPP" ? "WHATSAPP" : "ADMIN",
          client: tx,
        });
      }
    }
    const [next] = await tx.update(orders).set(patch).where(eq(orders.id, order.id)).returning();
    return next!;
  });

  await recordAudit({
    actorUserId: input.actor.id,
    actorLabel: input.actor.label,
    action: "ORDER_STATUS_CHANGED",
    resource: "order",
    resourceId: order.orderNumber,
    previousValue: { status: order.status },
    newValue: { status: input.status, reason: input.reason ?? null },
    source: input.source ?? "WEB",
  });

  const notificationType = (
    {
      PREPARING: "ORDER_PREPARING",
      PACKED: "ORDER_PACKED",
      OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
      DELIVERED: "ORDER_DELIVERED",
      CANCELLED: "ORDER_CANCELLED",
    } as const
  )[input.status as "PREPARING" | "PACKED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED"];

  if (notificationType) {
    await enqueueOrderNotification({
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      type: notificationType,
    });
  }

  return { order: updated, unchanged: false };
}

/* ------------------------------------------------------------ admin listing */

export type AdminOrderQuery = {
  status?: OrderStatus | "ALL";
  q?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export async function listOrdersAdmin(query: AdminOrderQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, query.pageSize ?? 20));
  const conditions: SQL[] = [];
  if (query.status && query.status !== "ALL") conditions.push(eq(orders.status, query.status));
  if (query.from) conditions.push(gte(orders.createdAt, query.from));
  if (query.to) conditions.push(lte(orders.createdAt, query.to));
  if (query.q && query.q.trim()) {
    const like = `%${query.q.trim()}%`;
    conditions.push(
      or(ilike(orders.orderNumber, like), ilike(users.name, like), ilike(users.email, like))!,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      total: orders.total,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      source: orders.source,
      createdAt: orders.createdAt,
      customerName: users.name,
      customerEmail: users.email,
      customerPhone: users.phone,
      itemCount: sql<number>`(SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id = ${orders.id})`,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(where);

  return { items: rows, total: toNum(countRows[0]?.count), page, pageSize };
}

export async function listOrderItemsForOrders(orderIds: number[]) {
  if (orderIds.length === 0) return [];
  return db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds));
}
