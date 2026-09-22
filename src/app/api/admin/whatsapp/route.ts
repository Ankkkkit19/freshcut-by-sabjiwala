import { z } from "zod";
import { ok, parseBody, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { configStatus, sendWhatsAppText } from "@/lib/whatsapp";
import { countWhatsAppMessages, listWhatsAppConsole } from "@/server/whatsapp-bot";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  const [console_, counts] = await Promise.all([listWhatsAppConsole(), countWhatsAppMessages()]);
  return ok({
    ...console_,
    counts,
    config: configStatus(),
    env: {
      hasAppSecret: Boolean(process.env.WHATSAPP_APP_SECRET),
      hasAccessToken: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
      hasVerifyToken: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
    },
  });
});

export const POST = route(async (request) => {
  const admin = await requireAdmin();
  const body = await parseBody(
    request,
    z.object({ phone: z.string().min(6), text: z.string().min(1).max(900) }),
  );
  const result = await sendWhatsAppText(body.phone, body.text);
  await recordAudit({
    actorUserId: admin.id,
    actorLabel: admin.email,
    action: "WHATSAPP_MESSAGE_SENT",
    resource: "whatsapp_message",
    resourceId: result.messageId,
    newValue: { phone: body.phone, status: result.status },
  });
  return ok({ result }, 201);
});
