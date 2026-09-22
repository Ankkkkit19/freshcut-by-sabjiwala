
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cartItems,
  categories,
  coupons,
  couponUsages,
  deliveryZones,
  products,
  productVariants,
} from "@/db/schema";
import { AppError } from "@/lib/api";
import { toNum } from "@/lib/utils";
import { getStoreSettings, type StoreSettings } from "@/server/settings";

export type RawCartRow = {
  cartItemId: number;
  quantity: string;
  preparation: string | null;
  variantId: number;
  variantLabel: string;
  unit: string;
  variantActive: boolean;
  price: string;
  mrp: string | null;
  stock: string;
  productId: number;
  productName: string;
  productSlug: string;
  productActive: boolean;
  images: string[];
  categoryId: number | null;
  categoryName: string | null;
};

export type QuoteLine = {
  cartItemId: number;
  variantId: number;
  productId: number;
  productName: string;
  productSlug: string;
  variantLabel: string;
  unit: string;
  imageUrl: string | null;
  preparation: string | null;
  quantity: number;
  unitPrice: number;
  unitMrp: number | null;
  lineTotal: number;
  availableStock: number;
  categoryId: number | null;
  isAvailable: boolean;
  issues: string[];
};

export type AppliedCoupon = {
  id: number;
  code: string;
  description: string | null;
  type: "PERCENTAGE" | "FIXED";
  value: number;
};

export type Quote = {
  lines: QuoteLine[];
  itemCount: number;
  subtotal: number;
  mrpTotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  taxPercent: number;
  total: number;
  savings: number;
  coupon: AppliedCoupon | null;
  couponMessage: string | null;
  delivery: {
    available: boolean;
    zoneId: number | null;
    area: string | null;
    city: string | null;
    pincode: string | null;
    etaMinutes: number | null;
    minOrderValue: number;
    freeDeliveryThreshold: number;
  };
  store: StoreSettings;
  checkoutBlocked: string | null;
};

export async function getRawCartRows(cartId: number): Promise<RawCartRow[]> {
  const rows = await db
    .select({
      cartItemId: cartItems.id,
      quantity: cartItems.quantity,
      preparation: cartItems.preparation,
      variantId: productVariants.id,
      variantLabel: productVariants.label,
      unit: productVariants.unit,
      variantActive: productVariants.isActive,
      price: productVariants.price,
      mrp: productVariants.mrp,
      stock: productVariants.stock,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      productActive: products.isActive,
      images: products.images,
      categoryId: products.categoryId,
      categoryName: categories.name,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(cartItems.id);
  return rows;
}

export function rowToLine(row: RawCartRow): QuoteLine {
  const quantity = toNum(row.quantity);
  const unitPrice = toNum(row.price);
  const availableStock = toNum(row.stock);
  const issues: string[] = [];
  if (!row.productActive) issues.push("Product is no longer available");
  if (!row.variantActive) issues.push("This variant has been discontinued");
  if (availableStock <= 0) issues.push("Out of stock");
  else if (quantity > availableStock) issues.push(`Only ${availableStock} ${row.unit.toLowerCase()} left`);
  return {
    cartItemId: row.cartItemId,
    variantId: row.variantId,
    productId: row.productId,
    productName: row.productName,
    productSlug: row.productSlug,
    variantLabel: row.variantLabel,
    unit: row.unit,
    imageUrl: row.images?.[0] ?? null,
    preparation: row.preparation,
    quantity,
    unitPrice,
    unitMrp: row.mrp ? toNum(row.mrp) : null,
    lineTotal: Math.round(unitPrice * quantity * 100) / 100,
    availableStock,
    categoryId: row.categoryId,
    isAvailable: row.productActive && row.variantActive && quantity <= availableStock,
    issues,
  };
}

/* ------------------------------------------------------------ coupons */

export async function evaluateCoupon(input: {
  code: string;
  subtotal: number;
  lines: QuoteLine[];
  userId: number | null;
}): Promise<{ coupon: AppliedCoupon; discount: number; message: string }> {
  const code = input.code.trim().toUpperCase();
  const rows = await db
    .select()
    .from(coupons)
    .where(sql`upper(${coupons.code}) = ${code}`)
    .limit(1);
  const coupon = rows[0];
  if (!coupon) {
    throw new AppError("COUPON_INVALID", `Coupon "${code}" is not valid.`);
  }
  const now = new Date();
  if (!coupon.isActive) throw new AppError("COUPON_INVALID", `Coupon "${code}" is no longer active.`);
  if (coupon.startsAt && coupon.startsAt > now) {
    throw new AppError("COUPON_INVALID", `Coupon "${code}" is not active yet.`);
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    throw new AppError("COUPON_INVALID", `Coupon "${code}" has expired.`);
  }
  const minOrder = toNum(coupon.minOrderValue);
  if (input.subtotal < minOrder) {
    throw new AppError(
      "COUPON_INVALID",
      `Coupon "${code}" needs a minimum order of ₹${minOrder}.`,
    );
  }
  if (coupon.usageLimit != null) {
    const usage = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(couponUsages)
      .where(eq(couponUsages.couponId, coupon.id));
    if (toNum(usage[0]?.count) >= coupon.usageLimit) {
      throw new AppError("COUPON_INVALID", `Coupon "${code}" has reached its usage limit.`);
    }
  }
  if (input.userId && coupon.perUserLimit > 0) {
    const perUser = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(couponUsages)
      .where(and(eq(couponUsages.couponId, coupon.id), eq(couponUsages.userId, input.userId)));
    if (toNum(perUser[0]?.count) >= coupon.perUserLimit) {
      throw new AppError(
        "COUPON_INVALID",
        `You have already used coupon "${code}" ${coupon.perUserLimit} time(s).`,
      );
    }
  }

  const applicableCategoryIds = coupon.applicableCategoryIds ?? [];
  const applicableProductIds = coupon.applicableProductIds ?? [];
  const restrictToSubset = applicableCategoryIds.length > 0 || applicableProductIds.length > 0;
  const eligibleLines = restrictToSubset
    ? input.lines.filter(
        (line) =>
          (line.categoryId != null && applicableCategoryIds.includes(line.categoryId)) ||
          applicableProductIds.includes(line.productId),
      )
    : input.lines;
  if (restrictToSubset && eligibleLines.length === 0) {
    throw new AppError(
      "COUPON_INVALID",
      `Coupon "${code}" is not applicable to the items in your cart.`,
    );
  }
  const eligibleTotal = eligibleLines.reduce((sum, l) => sum + l.lineTotal, 0);
  const value = toNum(coupon.value);
  let discount = coupon.type === "PERCENTAGE" ? (eligibleTotal * value) / 100 : value;
  const maxDiscount = coupon.maxDiscount ? toNum(coupon.maxDiscount) : null;
  if (maxDiscount != null && maxDiscount > 0) discount = Math.min(discount, maxDiscount);
  discount = Math.min(discount, input.subtotal);
  discount = Math.round(discount * 100) / 100;
  if (discount <= 0) {
    throw new AppError("COUPON_INVALID", `Coupon "${code}" does not give a discount on this cart.`);
  }
  return {
    coupon: {
      id: coupon.id,
      code: coupon.code.toUpperCase(),
      description: coupon.description,
      type: coupon.type,
      value,
    },
    discount,
    message:
      coupon.type === "PERCENTAGE"
        ? `${value}% off applied`
        : `₹${value} off applied`,
  };
}

/* ------------------------------------------------------------ delivery */

export async function resolveDeliveryZone(pincode?: string | null, area?: string | null) {
  if (!pincode) return null;
  const rows = await db
    .select()
    .from(deliveryZones)
    .where(and(eq(deliveryZones.pincode, pincode), eq(deliveryZones.isActive, true)));
  if (rows.length === 0) return null;
  if (area) {
    const exact = rows.find((r) => r.area.toLowerCase() === area.toLowerCase());
    if (exact) return exact;
  }
  return rows[0];
}

/**
 * The one and only place order amounts are calculated.
 * Cart page, checkout, order creation and the WhatsApp bot all use this.
 */
export async function buildQuote(input: {
  rows: RawCartRow[];
  pincode?: string | null;
  area?: string | null;
  couponCode?: string | null;
  userId?: number | null;
}): Promise<Quote> {
  const store = await getStoreSettings();
  const lines = input.rows.map(rowToLine);
  const itemCount = lines.length;
  const subtotal = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
  const mrpTotal =
    Math.round(lines.reduce((s, l) => s + (l.unitMrp ?? l.unitPrice) * l.quantity, 0) * 100) / 100;

  const zone = await resolveDeliveryZone(input.pincode, input.area);
  const minOrderValue = zone ? toNum(zone.minOrderValue) : store.minOrderValue;
  const freeDeliveryThreshold = zone
    ? toNum(zone.freeDeliveryThreshold)
    : store.freeDeliveryThreshold;

  let discount = 0;
  let coupon: AppliedCoupon | null = null;
  let couponMessage: string | null = null;
  if (input.couponCode && input.couponCode.trim() && itemCount > 0) {
    const evaluated = await evaluateCoupon({
      code: input.couponCode,
      subtotal,
      lines,
      userId: input.userId ?? null,
    });
    coupon = evaluated.coupon;
    discount = evaluated.discount;
    couponMessage = evaluated.message;
  }

  let deliveryFee = zone ? toNum(zone.deliveryFee) : store.defaultDeliveryFee;
  if (subtotal - discount >= freeDeliveryThreshold && freeDeliveryThreshold > 0) deliveryFee = 0;
  if (itemCount === 0) deliveryFee = 0;

  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round(((taxable * store.taxPercent) / 100) * 100) / 100;
  const total = Math.round((taxable + deliveryFee + tax) * 100) / 100;

  let checkoutBlocked: string | null = null;
  if (itemCount === 0) checkoutBlocked = "Your cart is empty.";
  else if (!zone) checkoutBlocked = "We do not deliver to this pincode yet.";
  else if (subtotal < minOrderValue)
    checkoutBlocked = `Minimum order value for ${zone.area} is ₹${minOrderValue}.`;
  else if (lines.some((l) => !l.isAvailable)) checkoutBlocked = "Some items are unavailable.";

  return {
    lines,
    itemCount,
    subtotal,
    mrpTotal,
    discount,
    deliveryFee,
    tax,
    taxPercent: store.taxPercent,
    total,
    savings: Math.round((mrpTotal - subtotal + discount) * 100) / 100,
    coupon,
    couponMessage,
    delivery: {
      available: Boolean(zone),
      zoneId: zone?.id ?? null,
      area: zone?.area ?? null,
      city: zone?.city ?? null,
      pincode: zone?.pincode ?? input.pincode ?? null,
      etaMinutes: zone?.etaMinutes ?? null,
      minOrderValue,
      freeDeliveryThreshold,
    },
    store,
    checkoutBlocked,
  };
}

export async function revalidateVariants(ids: number[]) {
  if (ids.length === 0) return [];
  return db.select().from(productVariants).where(inArray(productVariants.id, ids));
}
