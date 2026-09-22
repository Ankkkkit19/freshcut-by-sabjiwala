import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({
      status: "ok",
      service: "sabjiwala-freshcut",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "degraded", service: "sabjiwala-freshcut", database: "unavailable" },
      { status: 503 },
    );
  }
}
