
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  notifications,
  orders,
  users,
  whatsappIdentities,
  whatsappMessages,
} from "@/db/schema";
import { formatINR } from "@/lib/utils";
import { getStoreSettings } from "@/server/settings";

export type WhatsAppConfig = {
  appSecret: string | null;
  accessToken: string | null;
  phoneNumberId: string | null;
  verifyToken: string | null;
  graphVersion: string;
  /** True when Meta credentials are present and outbound sending is possible. */
  live: boolean;
  /** Explicit opt-in for signature-less local testing (never enable in production). */
  devBypass: boolean;
};

export function getWhatsAppConfig(): WhatsAppConfig {
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? null;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN ?? null;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? null;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? null;
  return {
    appSecret,
    accessToken,
    phoneNumberId,
    verifyToken,
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0",
    live: Boolean(accessToken && phoneNumberId),
    devBypass: process.env.WHATSAPP_DEV_BYPASS === "true",
  };
}

export function configStatus() {
  const config = getWhatsAppConfig();
  return {
    webhookConfigured: Boolean(config.appSecret && config.verifyToken),
    sendingConfigured: config.live,
    devBypass: config.devBypass,
    senderNumberConfigured: Boolean(config.phoneNumberId),
  };
}

/**
 * Timing-safe HMAC verification of X-Hub-Signature-256 against the raw body.
 * Rejects missing/invalid signatures and tampered payloads.
 */
export function verifyHubSignature(
  rawBody: string,
  signatureHeader: string | null,
): { ok: boolean; reason?: string } {
  const config = getWhatsAppConfig();
  if (!config.appSecret) {
    if (config.devBypass) return { ok: true, reason: "dev-bypass" };
    return { ok: false, reason: "WHATSAPP_APP_SECRET is not configured" };
  }
  if (!signatureHeader) return { ok: false, reason: "missing signature header" };
  const expected = `sha256=${createHmac("sha256", config.appSecret).update(rawBody, "utf8").digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return { ok: false, reason: "signature length mismatch" };
  if (!timingSafeEqual(a, b)) return { ok: false, reason: "signature mismatch" };
  return { ok: true };
}

export type SendResult = {
  status: "SENT" | "SKIPPED" | "FAILED";
  providerMessageId: string | null;
  error?: string;
  messageId: string;
};

/** Persists every outbound message, then attempts delivery when configured. */
export async function sendWhatsAppText(
  phone: string,
  body: string,
  options: { dedupeKey?: string } = {},
): Promise<SendResult> {
  const config = getWhatsAppConfig();
  const messageId = options.dedupeKey
    ? `out-${options.dedupeKey}`
    : `out-${randomUUID()}`;
  let status: SendResult["status"] = "SKIPPED";
  let providerMessageId: string | null = null;
  let error: string | undefined;

  if (config.live) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phone.replace(/^\+/, ""),
            type: "text",
            text: { body },
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { messages?: { id: string }[]; error?: { message?: string } }
        | null;
      if (!response.ok) {
        status = "FAILED";
        error = payload?.error?.message ?? `Graph API responded ${response.status}`;
      } else {
        status = "SENT";
        providerMessageId = payload?.messages?.[0]?.id ?? null;
      }
    } catch (err) {
      status = "FAILED";
      error = err instanceof Error ? err.message : "Unknown provider error";
    }
  } else {
    error = "WhatsApp Cloud API credentials are not configured - message logged only.";
  }

  await db
    .insert(whatsappMessages)
    .values({
      waMessageId: messageId,
      phone,
      direction: "OUTBOUND",
      type: "text",
      body,
      signatureVerified: false,
      handled: status === "SENT",
      error: error ?? null,
      payload: { status, providerMessageId },
    })
    .onConflictDoNothing({ target: whatsappMessages.waMessageId });

  return { status, providerMessageId, error, messageId };
}

export type OrderNotificationType =
  | "ORDER_CONFIRMED"
  | "ORDER_PREPARING"
  | "ORDER_PACKED"
  | "OUT_FOR_DELIVERY"
  | "ORDER_DELIVERED"
  | "ORDER_CANCELLED";

const NOTIFICATION_COPY: Record<
  OrderNotificationType,
  (orderNumber: string, extra: string) => string
> = {
  ORDER_CONFIRMED: (n, extra) =>
    `✅ *FreshCut order ${n} confirmed!*\n${extra}\nWe are cutting your vegetables fresh. Reply "track ${n}" anytime.`,
  ORDER_PREPARING: (n) => `🔪 Order ${n} is being prepared in our fresh-cut kitchen.`,
  ORDER_PACKED: (n) => `📦 Order ${n} is packed and waiting for the delivery partner.`,
  OUT_FOR_DELIVERY: (n) => `🚚 Order ${n} is out for delivery. Please keep your phone handy.`,
  ORDER_DELIVERED: (n) => `🎉 Order ${n} delivered. Thank you for shopping fresh with FreshCut!`,
  ORDER_CANCELLED: (n) =>
    `❌ Order ${n} has been cancelled. Any amount paid will be refunded within 3-5 days.`,
};

/**
 * Notification queue with database-level deduplication
 * (unique on order_id + type + channel). A failure never breaks the order.
 */
export async function enqueueOrderNotification(input: {
  orderId: number;
  orderNumber: string;
  userId: number;
  type: OrderNotificationType;
}) {
  const settings = await getStoreSettings();
  const rows = await db
    .select({ phone: users.phone, orderTotal: orders.total })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(eq(orders.id, input.orderId))
    .limit(1);
  const recipient = rows[0]?.phone ?? null;
  if (!recipient) return { status: "SKIPPED" as const };

  const identity = await db
    .select({ phone: whatsappIdentities.phone })
    .from(whatsappIdentities)
    .where(eq(whatsappIdentities.userId, input.userId))
    .limit(1);

  const inserted = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      orderId: input.orderId,
      type: input.type,
      channel: "WHATSAPP",
      recipient,
      status: settings.notificationsEnabled ? "QUEUED" : "SKIPPED",
      error: settings.notificationsEnabled ? null : "Notifications disabled in store settings.",
    })
    .onConflictDoNothing({
      target: [notifications.orderId, notifications.type, notifications.channel],
    })
    .returning({ id: notifications.id });

  // Already notified for this status - dedupe enforced by the DB constraint.
  if (inserted.length === 0) return { status: "DUPLICATE" as const };
  const notificationId = inserted[0]!.id;

  if (!settings.notificationsEnabled) return { status: "SKIPPED" as const };

  const extra =
    input.type === "ORDER_CONFIRMED"
      ? `Total: ${formatINR(rows[0]?.orderTotal)} • Delivery slot: ${settings.openingTime}-${settings.closingTime}`
      : "";
  const text = NOTIFICATION_COPY[input.type](input.orderNumber, extra);

  if (!identity[0]) {
    await db
      .update(notifications)
      .set({
        status: "SKIPPED",
        error: "Customer has not linked a WhatsApp number yet.",
      })
      .where(eq(notifications.id, notificationId));
    return { status: "SKIPPED" as const };
  }

  try {
    const result = await sendWhatsAppText(identity[0].phone, text, {
      dedupeKey: `${input.orderNumber}-${input.type}`,
    });
    await db
      .update(notifications)
      .set({
        status: result.status === "SENT" ? "SENT" : result.status === "FAILED" ? "FAILED" : "SKIPPED",
        providerMessageId: result.providerMessageId,
        error: result.error ?? null,
        sentAt: result.status === "SENT" ? new Date() : null,
      })
      .where(eq(notifications.id, notificationId));
    return { status: result.status };
  } catch (error) {
    await db
      .update(notifications)
      .set({
        status: "FAILED",
        error: error instanceof Error ? error.message : "provider error",
      })
      .where(eq(notifications.id, notificationId));
    return { status: "FAILED" as const };
  }
}

export async function linkIdentity(phone: string, userId: number) {
  const existingPhone = await db
    .select()
    .from(whatsappIdentities)
    .where(eq(whatsappIdentities.phone, phone))
    .limit(1);
  if (existingPhone[0] && existingPhone[0].userId !== userId) {
    return { ok: false as const, error: "This WhatsApp number is already linked to another account." };
  }
  await db
    .insert(whatsappIdentities)
    .values({ phone, userId })
    .onConflictDoUpdate({
      target: whatsappIdentities.phone,
      set: { userId, updatedAt: new Date() },
    });
  return { ok: true as const };
}

export async function recordInboundMessage(input: {
  waMessageId: string;
  phone: string;
  body: string;
  payload: unknown;
  signatureVerified: boolean;
}) {
  const inserted = await db
    .insert(whatsappMessages)
    .values({
      waMessageId: input.waMessageId,
      phone: input.phone,
      direction: "INBOUND",
      type: "text",
      body: input.body,
      payload: input.payload as never,
      signatureVerified: input.signatureVerified,
    })
    .onConflictDoNothing({ target: whatsappMessages.waMessageId })
    .returning({ id: whatsappMessages.id });
  return inserted.length > 0;
}

export async function markInboundHandled(waMessageId: string, error?: string) {
  await db
    .update(whatsappMessages)
    .set({ handled: !error, error: error ?? null })
    .where(eq(whatsappMessages.waMessageId, waMessageId));
}

export async function findLinkedUserByPhone(phone: string) {
  const rows = await db
    .select({
      userId: users.id,
      role: users.role,
      name: users.name,
      isActive: users.isActive,
      identityId: whatsappIdentities.id,
    })
    .from(whatsappIdentities)
    .innerJoin(users, eq(users.id, whatsappIdentities.userId))
    .where(and(eq(whatsappIdentities.phone, phone), eq(users.isActive, true)))
    .limit(1);
  return rows[0] ?? null;
}
