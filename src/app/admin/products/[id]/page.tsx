import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { productVariants, products } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { ProductEditor } from "@/components/admin/product-editor";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId)) notFound();

  const rows = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  const product = rows[0];
  if (!product) notFound();

  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(productVariants.sortOrder);

  return (
    <ProductEditor
      productId={productId}
      initial={{
        name: product.name,
        slug: product.slug,
        shortDescription: product.shortDescription,
        description: product.description,
        categoryId: product.categoryId,
        productType: product.productType,
        images: product.images,
        tags: product.tags,
        aliases: product.aliases,
        preparationTypes: product.preparationTypes,
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        variants: variants.map((variant) => ({
          id: variant.id,
          label: variant.label,
          unit: variant.unit,
          price: variant.price,
          mrp: variant.mrp,
          stock: variant.stock,
          weightInGrams: variant.weightInGrams,
          yieldRatio: variant.yieldRatio,
          isActive: variant.isActive,
          isDefault: variant.isDefault,
        })),
      }}
    />
  );
}
