import Link from "next/link";
import Image from "next/image";
import { and, desc, eq, gt, gte, sql } from "drizzle-orm";
import {
  BadgeCheck,
  Clock,
  Leaf,
  ShieldCheck,
  Sparkles,
  Truck,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { db } from "@/db";
import { offers, recipes } from "@/db/schema";
import { listCategories, listProducts } from "@/server/catalog";
import { getStoreSettings } from "@/server/settings";
import { ProductCard, ProductGrid } from "@/components/product-card";
import { Button } from "@/components/ui";

export const dynamic = "force-dynamic";

const WHY = [
  {
    icon: Leaf,
    title: "Cut fresh, never stored",
    body: "Your vegetables are chopped in our FSSAI-certified kitchen the same morning you order.",
  },
  {
    icon: BadgeCheck,
    title: "Honest pricing",
    body: "MRP is always the real pack MRP. No inflated ‘discounts’ — what you see is what you pay.",
  },
  {
    icon: Clock,
    title: "45-minute express slots",
    body: "Pick a slot at checkout; most Mumbai, Bengaluru and Delhi pincodes get same-slot delivery.",
  },
  {
    icon: UtensilsCrossed,
    title: "Recipe-ready packs",
    body: "Each ready-to-cook pack lists exactly which recipe it fits, so dinner is 10 minutes away.",
  },
];

export default async function HomePage() {
  const [categories, popular, freshToday, readyToCook, activeOffers, recipeIdeas, settings] =
    await Promise.all([
      listCategories(),
      listProducts({ featured: true, pageSize: 10 }),
      listProducts({ pageSize: 10, sort: "newest" }),
      listProducts({ readyToCook: true, pageSize: 5 }),
      db
        .select()
        .from(offers)
        .where(and(eq(offers.isActive, true), sql`(${offers.expiresAt} IS NULL OR ${offers.expiresAt} > now())`))
        .orderBy(offers.sortOrder)
        .limit(3),
      db
        .select({
          id: recipes.id,
          name: recipes.name,
          slug: recipes.slug,
          description: recipes.description,
          imageUrl: recipes.imageUrl,
          prepMinutes: recipes.prepMinutes,
          cookMinutes: recipes.cookMinutes,
          difficulty: recipes.difficulty,
        })
        .from(recipes)
        .where(eq(recipes.isActive, true))
        .orderBy(desc(recipes.createdAt))
        .limit(3),
      getStoreSettings(),
    ]);

  // Zone-driven trust strip (from real delivery zones).
  const zoneStats = await db.execute<{ count: number; fastest: number }>(
    sql`SELECT COUNT(*)::int AS count, COALESCE(MIN(eta_minutes), 45)::int AS fastest FROM delivery_zones WHERE is_active = true`,
  );

  return (
    <div className="space-y-10 sm:space-y-14">
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl border border-brand-100 bg-white">
        <div className="grid items-center gap-6 lg:grid-cols-2">
          <div className="p-6 sm:p-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
              <Sparkles className="h-3.5 w-3.5" /> Cut today, delivered today
            </span>
            <h1 className="mt-4 text-3xl font-bold leading-tight text-ink sm:text-4xl lg:text-5xl">
              Fresh vegetables. Fresh cuts. Delivered fresh.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-600 sm:text-base">
              {settings.storeName} brings the mandi to your door — whole produce, chopped sabzi mixes and
              recipe-ready packs from the FreshCut kitchen. Order on the website or on WhatsApp, both share
              the same cart.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/vegetables">
                <Button size="lg">Shop Fresh</Button>
              </Link>
              <Link href="/ready-to-cook">
                <Button size="lg" variant="secondary">
                  Explore Ready-to-Cook
                </Button>
              </Link>
            </div>
            <dl className="mt-6 grid max-w-md grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-brand-50/70 px-2 py-2">
                <dt className="text-[10px] uppercase tracking-wide text-brand-700">Delivery pincodes</dt>
                <dd className="text-lg font-semibold text-ink">{zoneStats.rows[0]?.count ?? 0}</dd>
              </div>
              <div className="rounded-xl bg-brand-50/70 px-2 py-2">
                <dt className="text-[10px] uppercase tracking-wide text-brand-700">Fastest slot</dt>
                <dd className="text-lg font-semibold text-ink">{zoneStats.rows[0]?.fastest ?? 45} min</dd>
              </div>
              <div className="rounded-xl bg-brand-50/70 px-2 py-2">
                <dt className="text-[10px] uppercase tracking-wide text-brand-700">Free delivery</dt>
                <dd className="text-lg font-semibold text-ink">₹{settings.freeDeliveryThreshold}+</dd>
              </div>
            </dl>
          </div>
          <div className="relative h-64 w-full sm:h-80 lg:h-full lg:min-h-[420px]">
            <Image
              src="/images/hero-basket.jpg"
              alt="FreshCut basket of fresh vegetables and fruits"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section aria-labelledby="categories-heading">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 id="categories-heading" className="text-xl font-semibold text-ink sm:text-2xl">
              Shop by category
            </h2>
            <p className="text-sm text-neutral-500">Everything from whole sabzi to chopped salad bowls.</p>
          </div>
          <Link href="/products" className="hidden text-sm font-medium text-brand-700 hover:underline sm:block">
            View all products
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/products?category=${category.slug}`}
                className="card-surface flex h-full flex-col overflow-hidden transition hover:border-brand-300"
              >
                <span className="relative block aspect-square bg-brand-50">
                  {category.imageUrl ? (
                    <Image
                      src={category.imageUrl}
                      alt={category.name}
                      fill
                      sizes="(max-width: 640px) 45vw, 180px"
                      className="object-cover"
                    />
                  ) : null}
                </span>
                <span className="p-2.5">
                  <span className="block text-sm font-semibold text-ink">{category.name}</span>
                  <span className="block text-[11px] text-neutral-500">{category.productCount} items</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Offers strip */}
      {activeOffers.length > 0 ? (
        <section aria-labelledby="offers-heading">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="offers-heading" className="text-xl font-semibold text-ink sm:text-2xl">
              Running offers
            </h2>
            <Link href="/offers" className="text-sm font-medium text-brand-700 hover:underline">
              See all offers
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3">
            {activeOffers.map((offer) => (
              <li key={offer.id} className="card-surface flex flex-col gap-2 p-4">
                <span className="inline-flex w-fit rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                  {offer.discountText ?? "Offer"}
                </span>
                <h3 className="text-base font-semibold text-ink">{offer.title}</h3>
                <p className="text-xs text-neutral-600">{offer.subtitle}</p>
                {offer.code ? (
                  <p className="text-xs font-semibold text-brand-700">Use code {offer.code}</p>
                ) : null}
                <Link href={offer.ctaHref ?? "/products"} className="mt-auto">
                  <Button size="sm" variant="secondary" className="w-full">
                    Shop now
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Popular */}
      <section aria-labelledby="popular-heading">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 id="popular-heading" className="text-xl font-semibold text-ink sm:text-2xl">
              Popular right now
            </h2>
            <p className="text-sm text-neutral-500">What Indian kitchens are adding this week.</p>
          </div>
          <Link href="/products" className="text-sm font-medium text-brand-700 hover:underline">
            Browse all
          </Link>
        </div>
        <ProductGrid>
          {popular.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </ProductGrid>
      </section>

      {/* Ready to cook */}
      <section aria-labelledby="rtc-heading" className="rounded-3xl bg-white p-4 sm:p-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 id="rtc-heading" className="text-xl font-semibold text-ink sm:text-2xl">
              Ready-to-Cook
            </h2>
            <p className="text-sm text-neutral-500">
              Chopped, grated and portioned in our cut kitchen. Yield controlled, waste tracked.
            </p>
          </div>
          <Link href="/ready-to-cook" className="text-sm font-medium text-brand-700 hover:underline">
            View all
          </Link>
        </div>
        <ProductGrid>
          {readyToCook.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </ProductGrid>
      </section>

      {/* Fresh today */}
      <section aria-labelledby="fresh-heading">
        <div className="mb-4">
          <h2 id="fresh-heading" className="text-xl font-semibold text-ink sm:text-2xl">
            Fresh today
          </h2>
          <p className="text-sm text-neutral-500">Newest arrivals from this morning&apos;s mandi run.</p>
        </div>
        <ProductGrid>
          {freshToday.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </ProductGrid>
      </section>

      {/* Recipes */}
      {recipeIdeas.length > 0 ? (
        <section aria-labelledby="recipes-heading">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="recipes-heading" className="text-xl font-semibold text-ink sm:text-2xl">
              Recipe ideas
            </h2>
            <Link href="/recipes" className="text-sm font-medium text-brand-700 hover:underline">
              All recipes
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-3">
            {recipeIdeas.map((recipe) => (
              <li key={recipe.id} className="card-surface overflow-hidden">
                <Link href={`/recipes/${recipe.slug}`}>
                  <span className="relative block h-40 bg-brand-50">
                    {recipe.imageUrl ? (
                      <Image src={recipe.imageUrl} alt={recipe.name} fill sizes="400px" className="object-cover" />
                    ) : null}
                  </span>
                </Link>
                <div className="p-4">
                  <h3 className="text-base font-semibold text-ink">{recipe.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{recipe.description}</p>
                  <p className="mt-2 text-[11px] font-medium text-brand-700">
                    {recipe.prepMinutes + recipe.cookMinutes} mins • {recipe.difficulty.toLowerCase()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Why */}
      <section aria-labelledby="why-heading">
        <h2 id="why-heading" className="mb-4 text-xl font-semibold text-ink sm:text-2xl">
          Why FreshCut
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map((item) => (
            <li key={item.title} className="card-surface p-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <item.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-ink">{item.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Trust / delivery */}
      <section className="grid gap-4 rounded-3xl bg-brand-700 p-5 text-white sm:p-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 className="text-xl font-semibold sm:text-2xl">Delivered by people who know vegetables</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-50">
            Cold-chain crates, tamper-proof packs and a delivery partner who calls before arriving. Track every
            order status — confirmed, preparing, packed, out for delivery, delivered — from your account or on
            WhatsApp.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/orders">
              <Button size="lg" variant="subtle">
                Track my order
              </Button>
            </Link>
            <a
              href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent("2 kg potato")}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button size="lg" variant="secondary">
                Order on WhatsApp
              </Button>
            </a>
          </div>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <li className="flex items-start gap-3 rounded-2xl bg-brand-600/60 p-3">
            <Truck className="mt-0.5 h-5 w-5" />
            <span className="text-xs leading-relaxed">
              Free delivery above ₹{settings.freeDeliveryThreshold}. Minimum order ₹{settings.minOrderValue}.
            </span>
          </li>
          <li className="flex items-start gap-3 rounded-2xl bg-brand-600/60 p-3">
            <ShieldCheck className="mt-0.5 h-5 w-5" />
            <span className="text-xs leading-relaxed">
              Stock is deducted atomically at checkout — no overselling, ever.
            </span>
          </li>
          <li className="flex items-start gap-3 rounded-2xl bg-brand-600/60 p-3">
            <Wallet className="mt-0.5 h-5 w-5" />
            <span className="text-xs leading-relaxed">
              Cash on delivery or UPI. Coupons applied server-side, always on the real cart value.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
