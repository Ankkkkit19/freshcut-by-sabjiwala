import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { ok, parseBody, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { settingsSchema } from "@/lib/validation";
import { getStoreSettings, updateStoreSettings } from "@/server/settings";
import { configStatus } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  const [settings, audit] = await Promise.all([
    getStoreSettings(),
    db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(25),
  ]);
  const envStatus = {
    databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    whatsapp: configStatus(),
  };
  return ok({ settings, audit, envStatus });
});

export const PUT = route(async (request) => {
  const admin = await requireAdmin();
  const body = await parseBody(request, settingsSchema);
  const before = await getStoreSettings();
  const settings = await updateStoreSettings(body);
  await recordAudit({
    actorUserId: admin.id,
    actorLabel: admin.email,
    action: "SETTINGS_UPDATED",
    resource: "settings",
    resourceId: "store",
    previousValue: before,
    newValue: settings,
  });
  return ok({ settings });
});

export const DELETE = route(async () => {
  await requireAdmin();
  const rows = await db.execute<{ count: number }>(sql`SELECT COUNT(*)::int AS count FROM audit_logs`);
  return ok({ auditLogCount: Number(rows.rows[0]?.count ?? 0) });
});
