import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { AppError, clientIp, ok, parseBody, rateLimit, route } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/utils";
import { signupSchema } from "@/lib/validation";

export const POST = route(async (request) => {
  rateLimit(`signup:${clientIp(request)}`, 10, 60_000);
  const body = await parseBody(request, signupSchema);
  const phone = body.phone ? normalizePhone(body.phone) : null;

  const existing = await db
    .select({ id: users.id, email: users.email, phone: users.phone })
    .from(users)
    .where(phone ? or(eq(users.email, body.email), eq(users.phone, phone)) : eq(users.email, body.email))
    .limit(1);
  if (existing[0]) {
    const conflict = existing[0].email === body.email ? "email" : "phone number";
    throw new AppError("CONFLICT", `An account with this ${conflict} already exists. Please sign in.`);
  }

  const passwordHash = await hashPassword(body.password);
  const inserted = await db
    .insert(users)
    .values({
      name: body.name,
      email: body.email,
      phone,
      passwordHash,
      role: "CUSTOMER",
    })
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role });

  const user = inserted[0]!;
  await createSession(user.id, {
    userAgent: request.headers.get("user-agent"),
    ip: clientIp(request),
  });
  return ok({ user: { id: user.id, name: user.name, email: user.email, role: user.role } }, 201);
});
