"use client";

export type ApiFailure = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

export class ApiError extends Error {
  code: string;
  details?: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

/** Browser-side fetch wrapper: unwraps `{ success, data }` and surfaces clean errors. */
export async function apiFetch<T>(
  url: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, ...rest } = init;
  const response = await fetch(url, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const payload = (await response.json().catch(() => null)) as
    | { success: true; data: T }
    | ApiFailure
    | null;
  if (!payload || payload.success !== true) {
    const error = payload && "error" in payload ? payload.error : undefined;
    throw new ApiError(
      error?.code ?? "INTERNAL_ERROR",
      error?.message ?? "Something went wrong. Please try again.",
      error?.details,
    );
  }
  return payload.data;
}

export function money(value: number | string | null | undefined): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
