import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminAccessDenied, AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/** Server-side guard: the ADMIN role always comes from the database session. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") {
    return <AdminAccessDenied email={user.email} />;
  }
  return <AdminShell admin={{ name: user.name, email: user.email }}>{children}</AdminShell>;
}
