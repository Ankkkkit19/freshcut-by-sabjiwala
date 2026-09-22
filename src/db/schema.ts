import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ---------------------------------------------------------------- enums */

export const userRoleEnum = pgEnum("user_role", ["CUSTOMER", "ADMIN"]);
export const addressTypeEnum = pgEnum("address_type", ["HOME", "WORK", "OTHER"]);
export const productTypeEnum = pgEnum("product_type", [
  "VEGETABLE",
  "FRUIT",
  "LEAFY_GREENS",
  "READY_TO_COOK",
  "DAIRY",
  "SALAD",
  "GROCERY",
]);
export const unitEnum = pgEnum("unit_type", [
  "KG",
  "G",
  "PIECE",
  "PACKET",
  "BOX",
  "BUNCH",
  "LITRE",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "CONFIRMED",
  "PREPARING",
  "PACKED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
]);
export const paymentMethodEnum = pgEnum("payment_method", ["COD", "UPI", "CARD", "WHATSAPP"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
]);
export const orderSourceEnum = pgEnum("order_source", ["WEB", "WHATSAPP"]);
export const stockTxnTypeEnum = pgEnum("stock_txn_type", [
  "RAW",
  "PREPARED",
  "RESERVED",
  "SOLD",
  "DAMAGED",
  "WASTAGE",
  "RETURN",
  "ADJUSTMENT",
]);
export const stockSourceEnum = pgEnum("stock_source", ["ADMIN", "WHATSAPP", "WEB", "SYSTEM"]);
export const couponTypeEnum = pgEnum("coupon_type", ["PERCENTAGE", "FIXED"]);
export const difficultyEnum = pgEnum("difficulty", ["EASY", "MEDIUM", "HARD"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "ORDER_CONFIRMED",
  "ORDER_PREPARING",
  "ORDER_PACKED",
  "OUT_FOR_DELIVERY",
  "ORDER_DELIVERED",
  "ORDER_CANCELLED",
]);
export const notificationChannelEnum = pgEnum("notification_channel", [
  "WHATSAPP",
  "EMAIL",
  "SMS",
]);
export const notificationStatusEnum = pgEnum("notification_status", [
  "QUEUED",
  "SENT",
  "FAILED",
  "SKIPPED",
]);
export const auditSourceEnum = pgEnum("audit_source", ["WEB", "WHATSAPP", "SYSTEM"]);
export const messageDirectionEnum = pgEnum("message_direction", ["INBOUND", "OUTBOUND"]);

/* ---------------------------------------------------------------- users */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    phone: text("phone"),
    name: text("name").notNull(),
    passwordHash: text("password_hash"),
    role: userRoleEnum("role").notNull().default("CUSTOMER"),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    uniqueIndex("users_phone_unique").on(t.phone),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("password_reset_token_unique").on(t.tokenHash)],
);

export const addresses = pgTable(
  "addresses",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label"),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    line1: text("line1").notNull(),
    street: text("street"),
    area: text("area").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    pincode: text("pincode").notNull(),
    landmark: text("landmark"),
    type: addressTypeEnum("type").notNull().default("HOME"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

/* ---------------------------------------------------------------- catalog */

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("categories_slug_unique").on(t.slug)],
);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    shortDescription: text("short_description"),
    description: text("description"),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    productType: productTypeEnum("product_type").notNull().default("VEGETABLE"),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
    preparationTypes: jsonb("preparation_types").$type<string[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("products_slug_unique").on(t.slug),
    index("products_category_idx").on(t.categoryId),
    index("products_active_idx").on(t.isActive),
  ],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    sku: text("sku").notNull(),
    unit: unitEnum("unit").notNull().default("KG"),
    weightInGrams: integer("weight_in_grams"),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    mrp: numeric("mrp", { precision: 10, scale: 2 }),
    stock: numeric("stock", { precision: 10, scale: 3 }).notNull().default("0"),
    /** For prepared items: kg of usable output produced from 1 kg of raw input. */
    yieldRatio: numeric("yield_ratio", { precision: 5, scale: 3 }),
    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("variants_sku_unique").on(t.sku),
    unique("variants_product_label_unique").on(t.productId, t.label),
    index("variants_product_idx").on(t.productId),
  ],
);

/* ---------------------------------------------------------------- cart */

export const carts = pgTable(
  "carts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    guestToken: text("guest_token"),
    whatsappPhone: text("whatsapp_phone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("carts_user_unique").on(t.userId),
    uniqueIndex("carts_guest_unique").on(t.guestToken),
    uniqueIndex("carts_whatsapp_unique").on(t.whatsappPhone),
  ],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: serial("id").primaryKey(),
    cartId: integer("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: integer("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
    preparation: text("preparation"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("cart_items_cart_variant_unique").on(t.cartId, t.variantId)],
);

/* ---------------------------------------------------------------- orders */

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderNumber: text("order_number").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: orderStatusEnum("status").notNull().default("CONFIRMED"),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
    deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }).notNull().default("0"),
    tax: numeric("tax", { precision: 10, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),
    couponCode: text("coupon_code"),
    couponId: integer("coupon_id").references(() => coupons.id, { onDelete: "set null" }),
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("COD"),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("PENDING"),
    deliveryZoneId: integer("delivery_zone_id").references(() => deliveryZones.id, {
      onDelete: "set null",
    }),
    deliverySlot: text("delivery_slot"),
    deliveryAddress: jsonb("delivery_address").$type<Record<string, string>>().notNull(),
    source: orderSourceEnum("source").notNull().default("WEB"),
    notes: text("notes"),
    estimatedDeliveryAt: timestamp("estimated_delivery_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_number_unique").on(t.orderNumber),
    index("orders_user_idx").on(t.userId),
    index("orders_status_idx").on(t.status),
    index("orders_created_idx").on(t.createdAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: integer("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    productName: text("product_name").notNull(),
    productSlug: text("product_slug"),
    variantLabel: text("variant_label").notNull(),
    unit: text("unit").notNull(),
    imageUrl: text("image_url"),
    preparation: text("preparation"),
    quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
    unitMrp: numeric("unit_mrp", { precision: 10, scale: 2 }),
    lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
    /** Cost of goods at the time of sale - used for margin analytics. */
    unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

/* ---------------------------------------------------------------- inventory */

export const stockItems = pgTable(
  "stock_items",
  {
    id: serial("id").primaryKey(),
    variantId: integer("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    onHand: numeric("on_hand", { precision: 10, scale: 3 }).notNull().default("0"),
    rawQty: numeric("raw_qty", { precision: 10, scale: 3 }).notNull().default("0"),
    preparedQty: numeric("prepared_qty", { precision: 10, scale: 3 }).notNull().default("0"),
    reservedQty: numeric("reserved_qty", { precision: 10, scale: 3 }).notNull().default("0"),
    soldQty: numeric("sold_qty", { precision: 10, scale: 3 }).notNull().default("0"),
    damagedQty: numeric("damaged_qty", { precision: 10, scale: 3 }).notNull().default("0"),
    wastageQty: numeric("wastage_qty", { precision: 10, scale: 3 }).notNull().default("0"),
    unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
    lowStockThreshold: numeric("low_stock_threshold", { precision: 10, scale: 3 })
      .notNull()
      .default("5"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("stock_items_variant_unique").on(t.variantId)],
);

export const stockTransactions = pgTable(
  "stock_transactions",
  {
    id: serial("id").primaryKey(),
    variantId: integer("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    type: stockTxnTypeEnum("type").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
    balanceAfter: numeric("balance_after", { precision: 10, scale: 3 }).notNull(),
    reason: text("reason"),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
    source: stockSourceEnum("source").notNull().default("ADMIN"),
    actorUserId: integer("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("stock_txn_variant_idx").on(t.variantId),
    index("stock_txn_created_idx").on(t.createdAt),
  ],
);

/* ---------------------------------------------------------------- coupons */

export const coupons = pgTable(
  "coupons",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    description: text("description"),
    type: couponTypeEnum("type").notNull().default("PERCENTAGE"),
    value: numeric("value", { precision: 10, scale: 2 }).notNull(),
    minOrderValue: numeric("min_order_value", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    maxDiscount: numeric("max_discount", { precision: 10, scale: 2 }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    usageLimit: integer("usage_limit"),
    perUserLimit: integer("per_user_limit").notNull().default(1),
    applicableCategoryIds: jsonb("applicable_category_ids").$type<number[]>().notNull().default([]),
    applicableProductIds: jsonb("applicable_product_ids").$type<number[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("coupons_code_unique").on(sql`upper(${t.code})`)],
);

export const couponUsages = pgTable(
  "coupon_usages",
  {
    id: serial("id").primaryKey(),
    couponId: integer("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    discount: numeric("discount", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("coupon_usages_order_unique").on(t.couponId, t.orderId)],
);

/* ---------------------------------------------------------------- delivery */

export const deliveryZones = pgTable(
  "delivery_zones",
  {
    id: serial("id").primaryKey(),
    pincode: text("pincode").notNull(),
    area: text("area").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull().default("Maharashtra"),
    deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }).notNull().default("29"),
    minOrderValue: numeric("min_order_value", { precision: 10, scale: 2 }).notNull().default("99"),
    freeDeliveryThreshold: numeric("free_delivery_threshold", { precision: 10, scale: 2 })
      .notNull()
      .default("499"),
    etaMinutes: integer("eta_minutes").notNull().default(45),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("delivery_zones_pincode_area_unique").on(t.pincode, t.area),
    index("delivery_zones_pincode_idx").on(t.pincode),
  ],
);

/* ---------------------------------------------------------------- recipes */

export const recipes = pgTable(
  "recipes",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    prepMinutes: integer("prep_minutes").notNull().default(10),
    cookMinutes: integer("cook_minutes").notNull().default(20),
    servings: integer("servings").notNull().default(2),
    difficulty: difficultyEnum("difficulty").notNull().default("EASY"),
    instructions: jsonb("instructions").$type<string[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("recipes_slug_unique").on(t.slug)],
);

export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: text("quantity").notNull(),
    productId: integer("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("recipe_ingredients_recipe_idx").on(t.recipeId)],
);

/* ---------------------------------------------------------------- offers */

export const offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  description: text("description"),
  imageUrl: text("image_url"),
  badge: text("badge"),
  discountText: text("discount_text"),
  code: text("code"),
  ctaHref: text("cta_href"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------------------------------------------------------------- audit + notifications */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorUserId: integer("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorLabel: text("actor_label").notNull().default("system"),
    action: text("action").notNull(),
    resource: text("resource").notNull(),
    resourceId: text("resource_id"),
    previousValue: jsonb("previous_value"),
    newValue: jsonb("new_value"),
    source: auditSourceEnum("source").notNull().default("WEB"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_created_idx").on(t.createdAt),
    index("audit_logs_action_idx").on(t.action),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    channel: notificationChannelEnum("channel").notNull().default("WHATSAPP"),
    recipient: text("recipient").notNull(),
    status: notificationStatusEnum("status").notNull().default("QUEUED"),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("notifications_dedupe_unique").on(t.orderId, t.type, t.channel),
    index("notifications_created_idx").on(t.createdAt),
  ],
);

/* ---------------------------------------------------------------- whatsapp */

export const whatsappIdentities = pgTable(
  "whatsapp_identities",
  {
    id: serial("id").primaryKey(),
    phone: text("phone").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("whatsapp_identities_phone_unique").on(t.phone),
    uniqueIndex("whatsapp_identities_user_unique").on(t.userId),
  ],
);

export const whatsappLinkTokens = pgTable(
  "whatsapp_link_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    phone: text("phone"),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("whatsapp_link_token_hash_unique").on(t.tokenHash),
    index("whatsapp_link_user_idx").on(t.userId),
  ],
);

export const whatsappSessions = pgTable(
  "whatsapp_sessions",
  {
    id: serial("id").primaryKey(),
    phone: text("phone").notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    state: text("state").notNull().default("IDLE"),
    context: jsonb("context").$type<Record<string, unknown>>().notNull().default({}),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("whatsapp_sessions_phone_unique").on(t.phone)],
);

export const whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    id: serial("id").primaryKey(),
    waMessageId: text("wa_message_id").notNull(),
    phone: text("phone").notNull(),
    direction: messageDirectionEnum("direction").notNull(),
    type: text("type").notNull().default("text"),
    body: text("body"),
    payload: jsonb("payload"),
    signatureVerified: boolean("signature_verified").notNull().default(false),
    handled: boolean("handled").notNull().default(false),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("whatsapp_messages_wa_id_unique").on(t.waMessageId),
    index("whatsapp_messages_phone_idx").on(t.phone),
  ],
);

export const whatsappPendingActions = pgTable(
  "whatsapp_pending_actions",
  {
    id: serial("id").primaryKey(),
    phone: text("phone").notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    summary: text("summary").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    resultText: text("result_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("whatsapp_pending_phone_idx").on(t.phone)],
);

/* ---------------------------------------------------------------- settings & counters */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const counters = pgTable("counters", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
});

/* ---------------------------------------------------------------- relations */

export const usersRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
  orders: many(orders),
  sessions: many(sessions),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(productVariants),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
  stockItem: one(stockItems, {
    fields: [productVariants.id],
    references: [stockItems.variantId],
  }),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(users, { fields: [carts.userId], references: [users.id] }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  variant: one(productVariants, {
    fields: [cartItems.variantId],
    references: [productVariants.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id],
  }),
}));

export const recipesRelations = relations(recipes, ({ many }) => ({
  ingredients: many(recipeIngredients),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeIngredients.recipeId],
    references: [recipes.id],
  }),
  product: one(products, {
    fields: [recipeIngredients.productId],
    references: [products.id],
  }),
}));

/* ---------------------------------------------------------------- types */

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type DeliveryZone = typeof deliveryZones.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
