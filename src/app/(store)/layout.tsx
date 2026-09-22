import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getCartCount } from "@/server/cart";
import { listCategories } from "@/server/catalog";
import { getStoreSettings } from "@/server/settings";
import { StoreBottomNav, StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const [user, categories, settings] = await Promise.all([
    getCurrentUser(),
    listCategories(),
    getStoreSettings(),
  ]);

  let cartCount = 0;
  try {
    cartCount = user ? await getCartCount() : 0;
  } catch {
    cartCount = 0;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <StoreHeader
        user={user ? { id: user.id, name: user.name, role: user.role } : null}
        cartCount={cartCount}
        announcement={settings.announcement}
        whatsappNumber={settings.whatsappNumber}
      />
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-3 pb-24 pt-4 sm:px-6 sm:pb-10">
        {children}
      </main>
      <StoreFooter
        categories={categories.map((c) => ({ name: c.name, slug: c.slug }))}
        settings={{
          storeName: settings.storeName,
          storePhone: settings.storePhone,
          whatsappNumber: settings.whatsappNumber,
          supportEmail: settings.supportEmail,
          openingTime: settings.openingTime,
          closingTime: settings.closingTime,
        }}
      />
      <StoreBottomNav />
    </div>
  );
}
