
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { productVariants, products, stockItems, stockTransactions } from "@/db/schema";
import { AppError } from "@/lib/api";
import { toNum } from "@/lib/utils";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbOrTx = typeof db | Tx;

export type StockTxnType =
  | "RAW"
  | "PREPARED"
  | "RESERVED"
  | "SOLD"
  | "DAMAGED"
  | "WASTAGE"
  | "RETURN"
  | "ADJUSTMENT";

export type AdjustStockInput = {
  variantId: number;
  type: StockTxnType;
  /** Sign matters for ADJUSTMENT / RESERVED; magnitude for SOLD / DAMAGED / WASTAGE. */
  quantity: number;
  reason?: string | null;
  orderId?: number | null;
  actorUserId?: number | null;
  source?: "ADMIN" | "WHATSAPP" | "WEB" | "SYSTEM";
  client?: DbOrTx;
};

/**
 * Convert a raw input into prepared output.
 * preparedKg = rawKg * yieldRatio  (e.g. 10kg raw -> 8kg prepared with ratio 0.8)
 */
export function computePreparedOutput(rawKg: number, yieldRatio: number): number {
  const ratio = yieldRatio > 0 && yieldRatio <= 1 ? yieldRatio : 1;
  return Math.round(rawKg * ratio * 1000) / 1000;
}

function deltaFor(type: StockTxnType, quantity: number): number {
  switch (type) {
    case "RAW":
    case "PREPARED":
    case "RETURN":
      return Math.abs(quantity);
    case "SOLD":
    case "DAMAGED":
    case "WASTAGE":
      return -Math.abs(quantity);
    case "RESERVED":
      return quantity; // signed: positive reserves, negative releases
    case "ADJUSTMENT":
      return quantity;
    default:
      return quantity;
  }
}

async function ensureStockItem(client: DbOrTx, variantId: number, initialOnHand: number) {
  const existing = await client
    .select()
    .from(stockItems)
    .where(eq(stockItems.variantId, variantId))
    .limit(1);
  if (existing[0]) return existing[0];
  const inserted = await client
    .insert(stockItems)
    .values({ variantId, onHand: String(initialOnHand) })
    .onConflictDoNothing({ target: stockItems.variantId })
    .returning();
  if (inserted[0]) return inserted[0];
  const again = await client
    .select()
    .from(stockItems)
    .where(eq(stockItems.variantId, variantId))
    .limit(1);
  return again[0]!;
}

/** Aggregate columns that track the inventory mix for a variant. */
function aggregatePatch(type: StockTxnType, magnitude: number) {
  switch (type) {
    case "RAW":
      return { rawDelta: magnitude };
    case "PREPARED":
      return { preparedDelta: magnitude };
    case "DAMAGED":
      return { damagedDelta: magnitude };
    case "WASTAGE":
      return { wastageDelta: magnitude };
    case "SOLD":
      return { soldDelta: magnitude };
    default:
      return {};
  }
}

/**
 * Single source of truth for stock mutation. Runs inside the caller's
 * transaction when one is supplied, so order placement can be atomic.
 * Negative stock is impossible: any decrement beyond the available balance throws.
 */
export async function adjustStock(input: AdjustStockInput) {
  const client = input.client ?? db;
  const delta = deltaFor(input.type, input.quantity);
  if (delta === 0) return { variantId: input.variantId, balanceAfter: 0, delta: 0 };

  const variantRows = await client
    .select()
    .from(productVariants)
    .where(eq(productVariants.id, input.variantId))
    .limit(1);
  const variant = variantRows[0];
  if (!variant) throw new AppError("NOT_FOUND", "Product variant not found.");

  // Row lock: prevents overselling when concurrent orders target the same variant.
  const locked = await client.execute<{ stock: string }>(
    sql`SELECT stock FROM product_variants WHERE id = ${input.variantId} FOR UPDATE`,
  );
  const currentStock = toNum(locked.rows[0]?.stock ?? variant.stock);

  const item = await ensureStockItem(client, input.variantId, currentStock);
  const appliesToOnHand = input.type !== "RESERVED";
  const nextOnHand = appliesToOnHand
    ? Math.round((currentStock + delta) * 1000) / 1000
    : currentStock;

  if (appliesToOnHand && nextOnHand < 0) {
    const productName = await client
      .select({ name: products.name })
      .from(products)
      .where(eq(products.id, variant.productId))
      .limit(1);
    throw new AppError(
      "INSUFFICIENT_STOCK",
      `${productName[0]?.name ?? "This product"} ${variant.label} is currently out of stock.`,
      { available: currentStock, requested: Math.abs(delta) },
    );
  }

  const magnitude = Math.abs(delta);
  const patch = aggregatePatch(input.type, magnitude);
  const reservedDelta =
    input.type === "RESERVED" ? delta : input.type === "SOLD" ? -Math.min(magnitude, toNum(item.reservedQty)) : 0;

  if (appliesToOnHand) {
    await client
      .update(productVariants)
      .set({ stock: String(nextOnHand), updatedAt: new Date() })
      .where(eq(productVariants.id, input.variantId));
  }

  await client
    .update(stockItems)
    .set({
      onHand: String(nextOnHand),
      ...(patch.rawDelta ? { rawQty: String(toNum(item.rawQty) + patch.rawDelta) } : {}),
      ...(patch.preparedDelta
        ? { preparedQty: String(toNum(item.preparedQty) + patch.preparedDelta) }
        : {}),
      ...(patch.soldDelta ? { soldQty: String(toNum(item.soldQty) + patch.soldDelta) } : {}),
      ...(patch.damagedDelta
        ? { damagedQty: String(toNum(item.damagedQty) + patch.damagedDelta) }
        : {}),
      ...(patch.wastageDelta
        ? { wastageQty: String(toNum(item.wastageQty) + patch.wastageDelta) }
        : {}),
      ...(reservedDelta
        ? {
            reservedQty: String(
              Math.max(0, Math.round((toNum(item.reservedQty) + reservedDelta) * 1000) / 1000),
            ),
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(stockItems.variantId, input.variantId));

  const [txn] = await client
    .insert(stockTransactions)
    .values({
      variantId: input.variantId,
      type: input.type,
      quantity: String(Math.round(delta * 1000) / 1000),
      balanceAfter: String(nextOnHand),
      reason: input.reason ?? null,
      orderId: input.orderId ?? null,
      actorUserId: input.actorUserId ?? null,
      source: input.source ?? "ADMIN",
    })
    .returning();

  return { variantId: input.variantId, balanceAfter: nextOnHand, delta, transaction: txn };
}

/**
 * Prepared-product yield: consumes raw input and produces usable prepared stock.
 * 10kg raw with ratio 0.8 -> 8kg sellable prepared stock.
 */
export async function produceFromRaw(input: {
  variantId: number;
  rawKg: number;
  reason?: string;
  actorUserId?: number | null;
  source?: "ADMIN" | "WHATSAPP" | "WEB" | "SYSTEM";
  client?: DbOrTx;
}) {
  const client = input.client ?? db;
  const rows = await client
    .select()
    .from(productVariants)
    .where(eq(productVariants.id, input.variantId))
    .limit(1);
  const variant = rows[0];
  if (!variant) throw new AppError("NOT_FOUND", "Product variant not found.");
  const ratio = variant.yieldRatio ? toNum(variant.yieldRatio, 1) : 1;
  const output = computePreparedOutput(input.rawKg, ratio);
  // Consume raw material first (this validates availability), then credit output.
  if (ratio < 1) {
    await adjustStock({
      ...input,
      type: "RAW",
      quantity: input.rawKg,
      reason: input.reason ?? "Raw intake",
      client,
    });
  }
  return adjustStock({
    ...input,
    type: "PREPARED",
    quantity: output,
    reason: input.reason ?? `Prepared from ${input.rawKg}kg raw @ ${ratio} yield`,
    client,
  });
}

export async function listStockTransactions(limit = 50) {
  return db
    .select({
      id: stockTransactions.id,
      type: stockTransactions.type,
      quantity: stockTransactions.quantity,
      balanceAfter: stockTransactions.balanceAfter,
      reason: stockTransactions.reason,
      source: stockTransactions.source,
      createdAt: stockTransactions.createdAt,
      orderId: stockTransactions.orderId,
      variantLabel: productVariants.label,
      sku: productVariants.sku,
      productName: products.name,
      productId: products.id,
    })
    .from(stockTransactions)
    .innerJoin(productVariants, eq(productVariants.id, stockTransactions.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .orderBy(desc(stockTransactions.createdAt))
    .limit(limit);
}

export async function listStockOverview() {
  return db
    .select({
      variantId: productVariants.id,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      isActive: products.isActive,
      variantActive: productVariants.isActive,
      label: productVariants.label,
      unit: productVariants.unit,
      price: productVariants.price,
      stock: productVariants.stock,
      yieldRatio: productVariants.yieldRatio,
      onHand: stockItems.onHand,
      soldQty: stockItems.soldQty,
      wastageQty: stockItems.wastageQty,
      damagedQty: stockItems.damagedQty,
      lowStockThreshold: stockItems.lowStockThreshold,
      updatedAt: stockItems.updatedAt,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(stockItems, eq(stockItems.variantId, productVariants.id))
    .orderBy(products.name, productVariants.sortOrder);
}

export async function listLowStock(limit = 10) {
  return db
    .select({
      variantId: productVariants.id,
      productName: products.name,
      label: productVariants.label,
      stock: productVariants.stock,
      unit: productVariants.unit,
      threshold: stockItems.lowStockThreshold,
      productSlug: products.slug,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(stockItems, eq(stockItems.variantId, productVariants.id))
    .where(
      and(
        eq(products.isActive, true),
        sql`${productVariants.stock} <= COALESCE(${stockItems.lowStockThreshold}, 5)`,
      ),
    )
    .orderBy(productVariants.stock)
    .limit(limit);
}
