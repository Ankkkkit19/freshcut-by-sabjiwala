import { randomUUID } from "node:crypto";
import { ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { markInboundHandled, recordInboundMessage } from "@/lib/whatsapp";
import { handleIncomingMessage } from "@/server/whatsapp-bot";
import { whatsappSimulateSchema } from "@/lib/validation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = whatsappSimulateSchema.extend({
  waMessageId: z.string().min(4).max(80).optional(),
});

/**
 * Admin-only sandbox that runs the exact same webhook pipeline (idempotency +
 * bot) so WhatsApp flows can be exercised without Meta credentials.
 * Reusing the same waMessageId demonstrates duplicate-suppression.
 */
export const POST = route(async (request) => {
  await requireAdmin();
  const body = await parseBody(request, schema);
  const waMessageId = body.waMessageId?.trim() || `sim-${randomUUID()}`;

  const isNew = await recordInboundMessage({
    waMessageId,
    phone: body.from,
    body: body.text,
    payload: { simulated: true, text: body.text },
    signatureVerified: false,
  });
  if (!isNew) {
    return ok({
      duplicate: true,
      waMessageId,
      message: "This message id was already processed - no duplicate cart/order side effects.",
    });
  }
  try {
    const replyText = await handleIncomingMessage({
      waMessageId,
      phone: body.from,
      text: body.text,
    });
    await markInboundHandled(waMessageId);
    return ok({ duplicate: false, waMessageId, reply: replyText }, 201);
  } catch (error) {
    await markInboundHandled(waMessageId, error instanceof Error ? error.message : "failed");
    throw error;
  }
});
