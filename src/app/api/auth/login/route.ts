import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { AppError, clientIp, ok, parseBody, rateLimit, route } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/utils";
import { loginSchema } from "@/lib/validation";

export const POST = route(async (request) => {
  rateLimit(`login:${clientIp(request)}`, 15, 60_000);
  const body = await parseBody(request, loginSchema);

  const identifier = body.identifier.trim();
  const phone = identifier.includes("@") ? null : normalizePhone(identifier);
  const rows = await db
    .select()
    .from(users)
    .where(
      phone
        ? or(eq(users.email, identifier.toLowerCase()), eq(users.phone, phone))
        : eq(users.email, identifier.toLowerCase()),
    )
    .limit(1);
  const user = rows[0];

  // Same error for unknown user and wrong password - no account enumeration.
  const valid = await verifyPassword(body.password, user?.passwordHash ?? null);
  if (!user || !valid) {
    throw new AppError("UNAUTHENTICATED", "Incorrect email/phone or password.");
  }
  if (!user.isActive) {
    throw new AppError("FORBIDDEN", "This account has been disabled. Please contact support.");
  }

  await createSession(user.id, {
    userAgent: request.headers.get("user-agent"),
    ip: clientIp(request),
  });
  return ok({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
  });
});
