
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { toNum } from "@/lib/utils";

export type RangeKey = "today" | "yesterday" | "7d" | "30d" | "custom";

export function resolveRange(input: {
  range?: string | null;
  from?: string | null;
  to?: string | null;
}): { key: RangeKey; from: Date; to: Date; label: string } {
  const now = new Date();
  const key = (input.range ?? "today") as RangeKey;
  const startOfDay = (d: Date) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
  };
  const endOfDay = (d: Date) => {
    const c = new Date(d);
    c.setHours(23, 59, 59, 999);
    return c;
  };
  if (key === "custom" && input.from && input.to) {
    const from = new Date(input.from);
    const to = new Date(input.to);
    return { key, from, to, label: `${input.from} → ${input.to}` };
  }
  if (key === "yesterday") {
    const y = new Date(now.getTime() - 24 * 3600 * 1000);
    return { key, from: startOfDay(y), to: endOfDay(y), label: "Yesterday" };
  }
  if (key === "7d") {
    return {
      key,
      from: startOfDay(new Date(now.getTime() - 6 * 24 * 3600 * 1000)),
      to: endOfDay(now),
      label: "Last 7 days",
    };
  }
  if (key === "30d") {
    return {
      key,
      from: startOfDay(new Date(now.getTime() - 29 * 24 * 3600 * 1000)),
      to: endOfDay(now),
      label: "Last 30 days",
    };
  }
  return { key: "today", from: startOfDay(now), to: endOfDay(now), label: "Today" };
}

export type DashboardStats = {
  orders: number;
  revenue: number;
  avgOrderValue: number;
  statusCounts: Record<string, number>;
  openOrders: number;
  totalCustomers: number;
  newCustomers: number;
  lowStockCount: number;
  outOfStockCount: number;
  whatsappOrders: number;
  revenueSeries: { date: string; revenue: number; orders: number }[];
  recentOrders: {
    orderNumber: string;
    status: string;
    total: string;
    customerName: string;
    createdAt: string;
    source: string;
  }[];
};

export async function getDashboardStats(range: {
  from: Date;
  to: Date;
}): Promise<DashboardStats> {
  const [totals, statuses, customers, stock, series, recent] = await Promise.all([
    db.execute<{ orders: number; revenue: string; aov: string; wa: number }>(sql`
      SELECT COUNT(*)::int AS orders,
             COALESCE(SUM(total), 0)::text AS revenue,
             COALESCE(AVG(total), 0)::text AS aov,
             COUNT(*) FILTER (WHERE source = 'WHATSAPP')::int AS wa
      FROM orders
      WHERE created_at BETWEEN ${range.from} AND ${range.to} AND status <> 'CANCELLED'
    `),
    db.execute<{ status: string; count: number }>(sql`
      SELECT status::text AS status, COUNT(*)::int AS count
      FROM orders WHERE created_at BETWEEN ${range.from} AND ${range.to}
      GROUP BY status
    `),
    db.execute<{ total: number; fresh: number }>(sql`
      SELECT (SELECT COUNT(*)::int FROM users WHERE role = 'CUSTOMER')::int AS total,
             (SELECT COUNT(*)::int FROM users WHERE role = 'CUSTOMER'
                AND created_at BETWEEN ${range.from} AND ${range.to})::int AS fresh
    `),
    db.execute<{ low: number; out: number }>(sql`
      SELECT COUNT(*) FILTER (WHERE v.stock > 0 AND v.stock <= COALESCE(si.low_stock_threshold, 5))::int AS low,
             COUNT(*) FILTER (WHERE v.stock <= 0)::int AS out
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      LEFT JOIN stock_items si ON si.variant_id = v.id
      WHERE v.is_active = true AND p.is_active = true
    `),
    db.execute<{ day: string; revenue: string; orders: number }>(sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             COALESCE(SUM(total), 0)::text AS revenue,
             COUNT(*)::int AS orders
      FROM orders
      WHERE created_at BETWEEN ${range.from} AND ${range.to} AND status <> 'CANCELLED'
      GROUP BY 1 ORDER BY 1
    `),
    db.execute<{
      order_number: string;
      status: string;
      total: string;
      customer_name: string;
      created_at: string;
      source: string;
    }>(sql`
      SELECT o.order_number, o.status::text AS status, o.total::text AS total,
             u.name AS customer_name, o.created_at::text AS created_at, o.source::text AS source
      FROM orders o JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC LIMIT 8
    `),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of statuses.rows) statusCounts[row.status] = toNum(row.count);
  const total = totals.rows[0];

  return {
    orders: toNum(total?.orders),
    revenue: toNum(total?.revenue),
    avgOrderValue: toNum(total?.aov),
    statusCounts,
    openOrders:
      toNum(statusCounts.CONFIRMED) +
      toNum(statusCounts.PREPARING) +
      toNum(statusCounts.PACKED) +
      toNum(statusCounts.OUT_FOR_DELIVERY),
    totalCustomers: toNum(customers.rows[0]?.total),
    newCustomers: toNum(customers.rows[0]?.fresh),
    lowStockCount: toNum(stock.rows[0]?.low),
    outOfStockCount: toNum(stock.rows[0]?.out),
    whatsappOrders: toNum(total?.wa),
    revenueSeries: series.rows.map((r) => ({
      date: r.day,
      revenue: toNum(r.revenue),
      orders: toNum(r.orders),
    })),
    recentOrders: recent.rows.map((r) => ({
      orderNumber: r.order_number,
      status: r.status,
      total: r.total,
      customerName: r.customer_name,
      createdAt: r.created_at,
      source: r.source,
    })),
  };
}

export async function getAnalytics(range: { from: Date; to: Date }) {
  const [daily, monthly, statusMix, topProducts, topCategories, customerMix, coupons, inventory] =
    await Promise.all([
      db.execute<{ day: string; revenue: string; orders: number }>(sql`
        SELECT to_char(date_trunc('day', created_at), 'DD Mon') AS day,
               COALESCE(SUM(total), 0)::text AS revenue, COUNT(*)::int AS orders
        FROM orders WHERE created_at BETWEEN ${range.from} AND ${range.to} AND status <> 'CANCELLED'
        GROUP BY date_trunc('day', created_at) ORDER BY date_trunc('day', created_at)
      `),
      db.execute<{ month: string; revenue: string; orders: number }>(sql`
        SELECT to_char(date_trunc('month', created_at), 'Mon YYYY') AS month,
               COALESCE(SUM(total), 0)::text AS revenue, COUNT(*)::int AS orders
        FROM orders WHERE status <> 'CANCELLED'
        GROUP BY date_trunc('month', created_at) ORDER BY date_trunc('month', created_at) DESC LIMIT 6
      `),
      db.execute<{ status: string; count: number; revenue: string }>(sql`
        SELECT status::text AS status, COUNT(*)::int AS count, COALESCE(SUM(total),0)::text AS revenue
        FROM orders WHERE created_at BETWEEN ${range.from} AND ${range.to} GROUP BY status
      `),
      db.execute<{ name: string; qty: string; revenue: string }>(sql`
        SELECT oi.product_name AS name,
               SUM(oi.quantity)::text AS qty,
               SUM(oi.line_total)::text AS revenue
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.created_at BETWEEN ${range.from} AND ${range.to} AND o.status <> 'CANCELLED'
        GROUP BY oi.product_name ORDER BY SUM(oi.line_total) DESC LIMIT 8
      `),
      db.execute<{ name: string; revenue: string; orders: number }>(sql`
        SELECT c.name AS name, COALESCE(SUM(oi.line_total), 0)::text AS revenue,
               COUNT(DISTINCT o.id)::int AS orders
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.slug = oi.product_slug
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE o.created_at BETWEEN ${range.from} AND ${range.to} AND o.status <> 'CANCELLED'
        GROUP BY c.name ORDER BY SUM(oi.line_total) DESC NULLS LAST LIMIT 8
      `),
      db.execute<{ new_customers: number; returning_customers: number }>(sql`
        WITH firsts AS (
          SELECT user_id, MIN(created_at) AS first_order FROM orders
          WHERE status <> 'CANCELLED' GROUP BY user_id
        )
        SELECT COUNT(*) FILTER (WHERE f.first_order BETWEEN ${range.from} AND ${range.to})::int AS new_customers,
               COUNT(*) FILTER (WHERE f.first_order < ${range.from})::int AS returning_customers
        FROM firsts f
      `),
      db.execute<{ code: string; uses: number; discount: string }>(sql`
        SELECT c.code, COUNT(cu.id)::int AS uses, COALESCE(SUM(cu.discount),0)::text AS discount
        FROM coupons c LEFT JOIN coupon_usages cu ON cu.coupon_id = c.id
        GROUP BY c.code ORDER BY COUNT(cu.id) DESC LIMIT 8
      `),
      db.execute<{ low: number; out: number; units: string }>(sql`
        SELECT COUNT(*) FILTER (WHERE v.stock > 0 AND v.stock <= COALESCE(si.low_stock_threshold,5))::int AS low,
               COUNT(*) FILTER (WHERE v.stock <= 0)::int AS out,
               COALESCE(SUM(v.stock * v.price), 0)::text AS units
        FROM product_variants v
        JOIN products p ON p.id = v.product_id
        LEFT JOIN stock_items si ON si.variant_id = v.id
        WHERE v.is_active = true AND p.is_active = true
      `),
    ]);

  const customers = customerMix.rows[0];
  const inv = inventory.rows[0];

  return {
    dailyRevenue: daily.rows.map((r) => ({
      label: r.day,
      revenue: toNum(r.revenue),
      orders: toNum(r.orders),
    })),
    monthlyRevenue: monthly.rows
      .map((r) => ({ label: r.month, revenue: toNum(r.revenue), orders: toNum(r.orders) }))
      .reverse(),
    statusMix: statusMix.rows.map((r) => ({
      status: r.status,
      count: toNum(r.count),
      revenue: toNum(r.revenue),
    })),
    topProducts: topProducts.rows.map((r) => ({
      name: r.name,
      quantity: toNum(r.qty),
      revenue: toNum(r.revenue),
    })),
    topCategories: topCategories.rows.map((r) => ({
      name: r.name ?? "Uncategorised",
      revenue: toNum(r.revenue),
      orders: toNum(r.orders),
    })),
    customers: {
      newCustomers: toNum(customers?.new_customers),
      returningCustomers: toNum(customers?.returning_customers),
    },
    coupons: coupons.rows.map((r) => ({
      code: r.code,
      uses: toNum(r.uses),
      discount: toNum(r.discount),
    })),
    inventory: {
      lowStock: toNum(inv?.low),
      outOfStock: toNum(inv?.out),
      stockValue: toNum(inv?.units),
    },
  };
}

export type CustomerRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  orderCount: number;
  totalSpent: string;
  lastOrderAt: string | null;
};

export async function listCustomers(input: { q?: string | null; limit?: number; offset?: number }) {
  const like = `%${(input.q ?? "").trim()}%`;
  const rows = await db.execute<CustomerRow>(sql`
    SELECT u.id, u.name, u.email, u.phone, u.is_active AS "isActive",
           u.created_at::text AS "createdAt",
           COALESCE(agg.order_count, 0)::int AS "orderCount",
           COALESCE(agg.total_spent, 0)::text AS "totalSpent",
           agg.last_order_at::text AS "lastOrderAt"
    FROM users u
    LEFT JOIN (
      SELECT user_id, COUNT(*)::int AS order_count, SUM(total) AS total_spent, MAX(created_at) AS last_order_at
      FROM orders WHERE status <> 'CANCELLED' GROUP BY user_id
    ) agg ON agg.user_id = u.id
    WHERE u.role = 'CUSTOMER'
      AND (${!input.q} OR u.name ILIKE ${like} OR u.email ILIKE ${like} OR COALESCE(u.phone,'') ILIKE ${like})
    ORDER BY COALESCE(agg.total_spent, 0) DESC, u.created_at DESC
    LIMIT ${input.limit ?? 25} OFFSET ${input.offset ?? 0}
  `);
  return rows.rows;
}
