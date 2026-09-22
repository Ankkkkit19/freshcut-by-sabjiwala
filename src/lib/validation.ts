import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(\+?\d[\d\s-]{8,15})$/, "Enter a valid phone number");

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or phone"),
  password: z.string().min(1, "Password is required"),
});

export const passwordRequestSchema = z.object({
  email: emailSchema,
});

export const passwordResetSchema = z.object({
  token: z.string().min(10, "Reset token is missing"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

export const addressSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(80),
  phone: phoneSchema,
  line1: z.string().trim().min(2, "House / flat is required").max(120),
  street: z.string().trim().max(160).optional().or(z.literal("")),
  area: z.string().trim().min(2, "Area is required").max(120),
  city: z.string().trim().min(2, "City is required").max(80),
  state: z.string().trim().min(2, "State is required").max(80),
  pincode: z.string().trim().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  landmark: z.string().trim().max(120).optional().or(z.literal("")),
  type: z.enum(["HOME", "WORK", "OTHER"]).default("HOME"),
  isDefault: z.boolean().default(false),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: phoneSchema.optional().or(z.literal("")),
  imageUrl: z.string().trim().url("Image URL must be valid").optional().or(z.literal("")),
});

export const cartAddSchema = z.object({
  variantId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive().max(100),
  preparation: z.string().trim().max(40).optional().or(z.literal("")),
});

export const cartUpdateSchema = z.object({
  itemId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().min(0).max(100),
});

export const checkoutSchema = z.object({
  addressId: z.coerce.number().int().positive(),
  couponCode: z.string().trim().max(30).optional().or(z.literal("")),
  deliverySlot: z.string().trim().max(60).optional().or(z.literal("")),
  paymentMethod: z.enum(["COD", "UPI", "WHATSAPP"]).default("COD"),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

export const quoteSchema = z.object({
  addressId: z.coerce.number().int().positive().optional(),
  pincode: z.string().trim().regex(/^\d{6}$/).optional(),
  couponCode: z.string().trim().max(30).optional().or(z.literal("")),
});

export const couponValidateSchema = z.object({
  code: z.string().trim().min(2).max(30),
});

export const orderStatusSchema = z.object({
  status: z.enum([
    "CONFIRMED",
    "PREPARING",
    "PACKED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
  ]),
  reason: z.string().trim().max(200).optional(),
});

export const variantInputSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  label: z.string().trim().min(1, "Variant label is required").max(40),
  sku: z.string().trim().max(60).optional().or(z.literal("")),
  unit: z.enum(["KG", "G", "PIECE", "PACKET", "BOX", "BUNCH", "LITRE"]).default("KG"),
  weightInGrams: z.coerce.number().int().nonnegative().optional().nullable(),
  price: z.coerce.number().nonnegative("Price must be positive"),
  mrp: z.coerce.number().nonnegative().optional().nullable(),
  stock: z.coerce.number().nonnegative().default(0),
  yieldRatio: z.coerce.number().positive().max(2).optional().nullable(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});

export const productInputSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  slug: z.string().trim().max(140).optional().or(z.literal("")),
  shortDescription: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  productType: z.enum([
    "VEGETABLE",
    "FRUIT",
    "LEAFY_GREENS",
    "READY_TO_COOK",
    "DAIRY",
    "SALAD",
    "GROCERY",
  ]),
  images: z.array(z.string().trim()).default([]),
  tags: z.array(z.string().trim()).default([]),
  aliases: z.array(z.string().trim()).default([]),
  preparationTypes: z.array(z.string().trim()).default([]),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  variants: z.array(variantInputSchema).min(1, "At least one variant is required"),
});

export const stockAdjustSchema = z.object({
  variantId: z.coerce.number().int().positive(),
  type: z.enum([
    "RAW",
    "PREPARED",
    "RESERVED",
    "SOLD",
    "DAMAGED",
    "WASTAGE",
    "RETURN",
    "ADJUSTMENT",
  ]),
  /** Positive to add, negative to remove (sign encodes direction for ADJUSTMENT). */
  quantity: z.coerce.number().refine((v) => v !== 0, "Quantity cannot be zero"),
  reason: z.string().trim().max(200).optional(),
});

export const couponInputSchema = z.object({
  code: z.string().trim().min(3).max(30),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  type: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.coerce.number().positive(),
  minOrderValue: z.coerce.number().nonnegative().default(0),
  maxDiscount: z.coerce.number().nonnegative().optional().nullable(),
  startsAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  usageLimit: z.coerce.number().int().nonnegative().optional().nullable(),
  perUserLimit: z.coerce.number().int().nonnegative().default(1),
  applicableCategoryIds: z.array(z.coerce.number().int()).default([]),
  applicableProductIds: z.array(z.coerce.number().int()).default([]),
  isActive: z.boolean().default(true),
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(100).optional().or(z.literal("")),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  imageUrl: z.string().trim().max(400).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const offerInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  subtitle: z.string().trim().max(160).optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  imageUrl: z.string().trim().max(400).optional().or(z.literal("")),
  badge: z.string().trim().max(40).optional().or(z.literal("")),
  discountText: z.string().trim().max(60).optional().or(z.literal("")),
  code: z.string().trim().max(30).optional().or(z.literal("")),
  ctaHref: z.string().trim().max(200).optional().or(z.literal("")),
  startsAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export const zoneInputSchema = z.object({
  pincode: z.string().trim().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  area: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  deliveryFee: z.coerce.number().nonnegative().default(29),
  minOrderValue: z.coerce.number().nonnegative().default(99),
  freeDeliveryThreshold: z.coerce.number().nonnegative().default(499),
  etaMinutes: z.coerce.number().int().positive().default(45),
  isActive: z.boolean().default(true),
});

export const recipeInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(140).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  imageUrl: z.string().trim().max(400).optional().or(z.literal("")),
  prepMinutes: z.coerce.number().int().nonnegative().default(10),
  cookMinutes: z.coerce.number().int().nonnegative().default(20),
  servings: z.coerce.number().int().positive().default(2),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("EASY"),
  instructions: z.array(z.string().trim()).default([]),
  ingredients: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        quantity: z.string().trim().min(1),
        productId: z.coerce.number().int().positive().nullable().optional(),
      }),
    )
    .default([]),
  isActive: z.boolean().default(true),
});

export const settingsSchema = z.object({
  storeName: z.string().trim().min(2).max(80),
  storePhone: z.string().trim().max(20),
  whatsappNumber: z.string().trim().max(20),
  supportEmail: z.string().trim().max(120),
  minOrderValue: z.coerce.number().nonnegative(),
  freeDeliveryThreshold: z.coerce.number().nonnegative(),
  defaultDeliveryFee: z.coerce.number().nonnegative(),
  taxPercent: z.coerce.number().min(0).max(28),
  openingTime: z.string().trim().max(10),
  closingTime: z.string().trim().max(10),
  codEnabled: z.boolean(),
  notificationsEnabled: z.boolean(),
  announcement: z.string().trim().max(160),
});

export const whatsappSimulateSchema = z.object({
  from: phoneSchema,
  text: z.string().trim().min(1).max(500),
});
