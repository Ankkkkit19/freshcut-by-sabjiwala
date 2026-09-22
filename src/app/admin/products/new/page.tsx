import { requireAdmin } from "@/lib/auth";
import { ProductEditor } from "@/components/admin/product-editor";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireAdmin();
  return <ProductEditor />;
}
