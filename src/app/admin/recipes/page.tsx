import { ResourceManager } from "@/components/admin/resource-manager";

export const dynamic = "force-dynamic";

export default function AdminRecipesPage() {
  return <ResourceManager resource="recipes" />;
}
