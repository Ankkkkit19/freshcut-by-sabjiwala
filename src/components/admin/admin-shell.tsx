"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgePercent,
  Boxes,
  ChevronLeft,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Percent,
  Settings,
  ShoppingBasket,
  Store,
  Tags,
  Truck,
  TrendingUp,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/client";
import { cn } from "@/lib/utils";
import { useUi } from "@/components/store";
import { Button } from "@/components/ui";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/products", label: "Products", icon: ShoppingBasket },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/delivery", label: "Delivery", icon: Truck },
  { href: "/admin/coupons", label: "Coupons", icon: Percent },
  { href: "/admin/offers", label: "Offers", icon: BadgePercent },
  { href: "/admin/recipes", label: "Recipes", icon: UtensilsCrossed },
  { href: "/admin/analytics", label: "Analytics", icon: TrendingUp },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({
  children,
  admin,
}: {
  children: ReactNode;
  admin: { name: string; email: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggleSidebar = useUi((s) => s.toggleSidebar);

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-1 overflow-y-auto p-3">
      <Link href="/admin" className="mb-2 flex items-center gap-2 px-1">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
          <Leaf className="h-5 w-5" />
        </span>
        {!collapsed ? (
          <span className="leading-tight">
            <span className="block text-sm font-bold text-brand-800">FreshCut Admin</span>
            <span className="block text-[10px] uppercase tracking-wide text-neutral-500">Sabjiwala ops</span>
          </span>
        ) : null}
      </Link>
      <nav aria-label="Admin" className="flex-1 space-y-0.5">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setDrawerOpen(false)}
              aria-current={active ? "page" : undefined}
              title={item.label}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition",
                active ? "bg-brand-600 text-white" : "text-brand-900 hover:bg-brand-50",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t border-brand-100 pt-2">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-brand-900 hover:bg-brand-50"
        >
          <Store className="h-4 w-4" /> {!collapsed ? "View storefront" : null}
        </Link>
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" /> {!collapsed ? "Sign out" : null}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-cream">
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 border-r border-brand-100 bg-white lg:block",
          collapsed ? "w-[68px]" : "w-60",
        )}
      >
        {sidebar}
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-brand-100 bg-white/95 px-3 py-2.5 backdrop-blur sm:px-4">
          <button
            type="button"
            aria-label="Open admin menu"
            className="grid h-9 w-9 place-items-center rounded-full text-brand-800 hover:bg-brand-50 lg:hidden"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden h-9 w-9 place-items-center rounded-full text-brand-800 hover:bg-brand-50 lg:grid"
            onClick={toggleSidebar}
          >
            <ChevronLeft className={cn("h-5 w-5 transition", collapsed && "rotate-180")} />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{admin.name}</p>
            <p className="truncate text-[11px] text-neutral-500">{admin.email} • ADMIN</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" className="hidden sm:block">
              <Button size="sm" variant="outline">
                Storefront
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={logout} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-5">{children}</main>
      </div>
    </div>
  );
}

export function AdminAccessDenied({ email }: { email?: string }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-red-600">
        <X className="h-7 w-7" />
      </span>
      <h1 className="mt-3 text-xl font-bold text-ink">Admin access required</h1>
      <p className="mt-1 text-sm text-neutral-600">
        {email ? `The account ${email} does not have the ADMIN role.` : "Please sign in with an admin account."}
      </p>
      <Link href="/" className="mt-4 inline-block">
        <Button variant="outline">Back to store</Button>
      </Link>
    </div>
  );
}
