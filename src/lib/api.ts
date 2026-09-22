import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INSUFFICIENT_STOCK"
  | "PRODUCT_UNAVAILABLE"
  | "MIN_ORDER_NOT_MET"
  | "COUPON_INVALID"
  | "DELIVERY_UNAVAILABLE"
  | "EMPTY_CART"
  | "RATE_LIMITED"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INSUFFICIENT_STOCK: 409,
  PRODUCT_UNAVAILABLE: 409,
  MIN_ORDER_NOT_MET: 400,
  COUPON_INVALID: 400,
  DELIVERY_UNAVAILABLE: 400,
  EMPTY_CART: 400,
  RATE_LIMITED: 429,
  BAD_REQUEST: 400,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  code: ApiErrorCode;
  status: number;
  details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ success: true, data }, { status: init ?? 200 });
}

export function fail(code: ApiErrorCode, message: string, details?: unknown) {
  return NextResponse.json(
    { success: false, error: { code, message, ...(details ? { details } : {}) } },
    { status: STATUS_BY_CODE[code] },
  );
}

/** Uniform error translation - never leaks DB internals or stack traces. */
export function toErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return fail(error.code, error.message, error.details);
  }
  if (error instanceof ZodError) {
    return fail("VALIDATION_ERROR", "Please check the submitted values.", {
      issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  console.error("[api] unexpected error", error);
  return fail("INTERNAL_ERROR", "Something went wrong. Please try again.");
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new AppError("BAD_REQUEST", "Request body must be valid JSON.");
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", "Please check the submitted values.", {
      issues: result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }
  return result.data;
}

/** Wrap a route handler so thrown AppErrors/Zod errors become clean JSON. */
export function route<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>,
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/* ------------------------------------------------------------- rate limiting */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Lightweight in-process rate limiter for auth / webhook abuse protection.
 * Redis-backed limiting can be swapped in for multi-instance deployments.
 */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    }
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    throw new AppError("RATE_LIMITED", "Too many requests. Please try again shortly.");
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
