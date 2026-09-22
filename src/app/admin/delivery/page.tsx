import { ResourceManager } from "@/components/admin/resource-manager";

export const dynamic = "force-dynamic";

export default function AdminDeliveryPage() {
  return <ResourceManager resource="zones" />;
}
