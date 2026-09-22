import { z } from "zod";
import { AppError, ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { deleteResource, isResource, updateResource } from "@/server/admin-resources";

export const dynamic = "force-dynamic";

export const PATCH = route(
  async (request, ctx: { params: Promise<{ resource: string; id: string }> }) => {
    const admin = await requireAdmin();
    const { resource, id } = await ctx.params;
    if (!isResource(resource)) throw new AppError("NOT_FOUND", "Unknown admin resource.");
    const body = await parseBody(request, z.record(z.string(), z.unknown()));
    const item = await updateResource(resource, Number(id), body, {
      id: admin.id,
      label: admin.email,
    });
    return ok({ item });
  },
);

export const DELETE = route(
  async (_request, ctx: { params: Promise<{ resource: string; id: string }> }) => {
    const admin = await requireAdmin();
    const { resource, id } = await ctx.params;
    if (!isResource(resource)) throw new AppError("NOT_FOUND", "Unknown admin resource.");
    const result = await deleteResource(resource, Number(id), { id: admin.id, label: admin.email });
    return ok(result);
  },
);
