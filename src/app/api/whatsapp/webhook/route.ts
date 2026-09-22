import { NextResponse } from "next/server";
import { clientIp, rateLimit, route } from "@/lib/api";
import {
  getWhatsAppConfig,
  markInboundHandled,
  recordInboundMessage,
  verifyHubSignature,
} from "@/lib/whatsapp";
import { handleIncomingMessage } from "@/server/whatsapp-bot";

export const dynamic = "force-dynamic";

type WhatsAppWebhookPayload = {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: {
          id: string;
          from: string;
          type: string;
          text?: { body?: string };
        }[];
      };
    }[];
  }[];
};

/** Meta webhook verification handshake. */
export const GET = route(async (request) => {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const config = getWhatsAppConfig();
  if (mode === "subscribe" && token && config.verifyToken && token === config.verifyToken) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
});

/**
 * Inbound message webhook.
 * - X-Hub-Signature-256 is verified against the raw body with a timing-safe compare.
 * - Every message id is persisted with a unique constraint, so retries are no-ops.
 */
export const POST = route(async (request) => {
  rateLimit(`wa-webhook:${clientIp(request)}`, 240, 60_000);
  const rawBody = await request.text();
  const verification = verifyHubSignature(rawBody, request.headers.get("x-hub-signature-256"));
  if (!verification.ok) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "FORBIDDEN", message: `Webhook rejected: ${verification.reason}` },
      },
      { status: 401 },
    );
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Malformed payload." } },
      { status: 400 },
    );
  }

  const messages =
    payload.entry?.flatMap((entry) =>
      (entry.changes ?? []).flatMap((change) => change.value?.messages ?? []),
    ) ?? [];

  const processed: { id: string; duplicate: boolean }[] = [];

  for (const message of messages) {
    if (message.type !== "text" || !message.text?.body) {
      processed.push({ id: message.id, duplicate: false });
      continue;
    }
    // Idempotency: same message id delivered twice must not double-process.
    const isNew = await recordInboundMessage({
      waMessageId: message.id,
      phone: message.from,
      body: message.text.body,
      payload: message,
      signatureVerified: verification.reason !== "dev-bypass",
    });
    if (!isNew) {
      processed.push({ id: message.id, duplicate: true });
      continue;
    }
    try {
      await handleIncomingMessage({
        waMessageId: message.id,
        phone: message.from,
        text: message.text.body,
      });
      await markInboundHandled(message.id);
    } catch (error) {
      console.error("[whatsapp] handling failed", error);
      await markInboundHandled(
        message.id,
        error instanceof Error ? error.message : "unknown error",
      );
    }
    processed.push({ id: message.id, duplicate: false });
  }

  return NextResponse.json({ success: true, data: { received: processed } });
});
