/** Shared client/server types for API payloads (no server-only imports). */

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
  coupon: { id: number; code: string; description: string | null; type: string; value: number } | null;
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
  store: {
    storeName: string;
    minOrderValue: number;
    freeDeliveryThreshold: number;
    defaultDeliveryFee: number;
    taxPercent: number;
    codEnabled: boolean;
  };
  checkoutBlocked: string | null;
};

export type AddressRecord = {
  id: number;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  street: string | null;
  area: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string | null;
  type: "HOME" | "WORK" | "OTHER";
  isDefault: boolean;
};

export type OrderSummaryRow = {
  id: number;
  orderNumber: string;
  status: string;
  total: string;
  subtotal: string;
  discount: string;
  deliveryFee: string;
  tax: string;
  createdAt: string;
  estimatedDeliveryAt: string | null;
  itemCount: number;
  previewImages: string[] | null;
};
