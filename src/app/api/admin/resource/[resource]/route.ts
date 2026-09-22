import { AppError, ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { createResource, isResource, listResource } from "@/server/admin-resources";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const GET = route(async (_request, ctx: { params: Promise<{ resource: string }> }) => {
  await requireAdmin();
  const { resource } = await ctx.params;
  if (!isResource(resource)) throw new AppError("NOT_FOUND", "Unknown admin resource.");
  const items = await listResource(resource);
  return ok({ items });
});

export const POST = route(async (request, ctx: { params: Promise<{ resource: string }> }) => {
  const admin = await requireAdmin();
  const { resource } = await ctx.params;
  if (!isResource(resource)) throw new AppError("NOT_FOUND", "Unknown admin resource.");
  const body = await parseBody(request, z.record(z.string(), z.unknown()));
  const created = await createResource(resource, body, { id: admin.id, label: admin.email });
  return ok({ item: created }, 201);
});
