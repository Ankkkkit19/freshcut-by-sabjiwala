
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { counters, auditLogs, orders } from "@/db/schema";

export type AuditSource = "WEB" | "WHATSAPP" | "SYSTEM";

export type AuditInput = {
  actorUserId?: number | null;
  actorLabel?: string;
  action: string;
  resource: string;
  resourceId?: string | number | null;
  previousValue?: unknown;
  newValue?: unknown;
  source?: AuditSource;
};

/** Append-only audit trail for sensitive admin operations. */
export async function recordAudit(input: AuditInput): Promise<void> {
  await db.insert(auditLogs).values({
    actorUserId: input.actorUserId ?? null,
    actorLabel: input.actorLabel ?? "system",
    action: input.action,
    resource: input.resource,
    resourceId: input.resourceId != null ? String(input.resourceId) : null,
    previousValue: (input.previousValue ?? null) as never,
    newValue: (input.newValue ?? null) as never,
    source: input.source ?? "WEB",
  });
}

/**
 * Atomic, collision-free public order numbers: SW10001, SW10002, ...
 * The counter is advanced with a single atomic upsert; if a number is somehow
 * already taken (e.g. imported data), we advance again instead of failing.
 */
export async function nextOrderNumber(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await db.execute<{ value: number }>(sql`
      INSERT INTO counters (key, value) VALUES ('order_number', 10000)
      ON CONFLICT (key) DO UPDATE SET value = counters.value + 1
      RETURNING value
    `);
    const value = Number(result.rows[0]?.value ?? 10001);
    const candidate = `SW${value}`;
    const existing = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.orderNumber, candidate))
      .limit(1);
    if (!existing[0]) return candidate;
  }
  return `SW${Date.now()}`;
}
