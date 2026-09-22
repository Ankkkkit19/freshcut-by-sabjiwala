import { requireAdmin } from "@/lib/auth";
import { DashboardView } from "@/components/admin/dashboard-view";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  return <DashboardView adminName={admin.name} />;
}
