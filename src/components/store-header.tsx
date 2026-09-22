"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Home,
  Leaf,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingCart,
  Sparkles,
  User,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/client";
import { cn } from "@/lib/utils";
import { useCartUi, useUi } from "@/components/store";
import { Button, Input, useToast } from "@/components/ui";

export type HeaderUser = { id: number; name: string; role: "CUSTOMER" | "ADMIN" } | null;
export type HeaderCategory = { id: number; name: string; slug: string };

type Suggestion = { name: string; slug: string; category: string | null; priceFrom: number };

const NAV = [
  { href: "/vegetables", label: "Vegetables" },
  { href: "/fruits", label: "Fruits" },
  { href: "/ready-to-cook", label: "Ready to Cook" },
  { href: "/recipes", label: "Recipes" },
  { href: "/offers", label: "Offers" },
];

export function StoreHeader({
  user,
  cartCount,
  announcement,
  whatsappNumber,
}: {
  user: HeaderUser;
  cartCount: number;
  announcement: string | null;
  whatsappNumber: string;
}) {
  const router = useRouter();
  const { push } = useToast();
  const count = useCartUi((s) => s.count);
  const setCount = useCartUi((s) => s.setCount);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileNavOpen = useUi((s) => s.mobileNavOpen);
  const setMobileNav = useUi((s) => s.setMobileNav);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCount(cartCount);
  }, [cartCount, setCount]);

  useEffect(() => {
    setMobileOpen(mobileNavOpen);
  }, [mobileNavOpen]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiFetch<{ suggestions: Suggestion[] }>(
          `/api/search?q=${encodeURIComponent(query)}&suggest=true`,
          { signal: controller.signal },
        );
        setSuggestions(data.suggestions);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setSuggestions([]);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setSuggestions([]);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  async function logout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      setCount(0);
      push("Signed out", "info");
      router.push("/");
      router.refresh();
    } catch {
      push("Could not sign out. Please retry.", "error");
    }
  }

  return (
    <>
      {announcement ? (
        <div className="bg-brand-700 px-4 py-1.5 text-center text-[11px] font-medium text-white sm:text-xs">
          {announcement} • WhatsApp orders: {whatsappNumber}
        </div>
      ) : null}

      <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:px-5">
          <button
            type="button"
            aria-label="Open menu"
            className="grid h-9 w-9 place-items-center rounded-full text-brand-800 hover:bg-brand-50 lg:hidden"
            onClick={() => {
              setMobileNav(!mobileOpen);
              setMobileOpen(!mobileOpen);
            }}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
              <Leaf className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-bold text-brand-800">FreshCut</span>
              <span className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                by Sabjiwala
              </span>
            </span>
          </Link>

          <nav aria-label="Main" className="ml-2 hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-2 text-sm font-medium text-brand-900 transition hover:bg-brand-50"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div ref={searchRef} className="relative ml-auto hidden max-w-md flex-1 sm:block">
            <form onSubmit={submitSearch} role="search">
              <label htmlFor="header-search" className="sr-only">
                Search products
              </label>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                <Search className="h-4 w-4" />
              </span>
              <Input
                id="header-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search aloo, tamatar, paneer…"
                className="pl-9"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={suggestions.length > 0}
              />
            </form>
            {query.trim().length >= 2 ? (
              <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-brand-100 bg-white shadow-lg">
                {searching ? (
                  <p className="px-3 py-3 text-xs text-neutral-500">Searching…</p>
                ) : suggestions.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-neutral-500">
                    We couldn&apos;t find anything matching “{query}”. Try another search.
                  </p>
                ) : (
                  <ul>
                    {suggestions.map((suggestion) => (
                      <li key={suggestion.slug}>
                        <Link
                          href={`/products/${suggestion.slug}`}
                          onClick={() => setSuggestions([])}
                          className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-brand-50"
                        >
                          <span className="truncate">
                            {suggestion.name}
                            {suggestion.category ? (
                              <span className="ml-2 text-[11px] text-neutral-400">{suggestion.category}</span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-brand-700">
                            ₹{suggestion.priceFrom}
                          </span>
                        </Link>
                      </li>
                    ))}
                    <li className="border-t border-brand-50">
                      <Link
                        href={`/search?q=${encodeURIComponent(query)}`}
                        className="block px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50"
                      >
                        See all results for “{query}”
                      </Link>
                    </li>
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-1 sm:ml-0">
            <Link
              href="/search"
              aria-label="Search"
              className="grid h-9 w-9 place-items-center rounded-full text-brand-800 hover:bg-brand-50 sm:hidden"
            >
              <Search className="h-5 w-5" />
            </Link>

            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((open) => !open)}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium text-brand-900 hover:bg-brand-50"
              >
                <User className="h-5 w-5" />
                <span className="hidden max-w-24 truncate sm:inline">
                  {user ? user.name.split(" ")[0] : "Account"}
                </span>
                <ChevronDown className="hidden h-3.5 w-3.5 sm:block" />
              </button>
              {accountOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-brand-100 bg-white py-1 shadow-lg"
                >
                  {user ? (
                    <>
                      <div className="border-b border-brand-50 px-3 py-2">
                        <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                        <p className="text-[11px] uppercase tracking-wide text-brand-600">{user.role}</p>
                      </div>
                      <Link href="/profile" role="menuitem" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-brand-50">
                        <User className="h-4 w-4" /> My profile
                      </Link>
                      <Link href="/orders" role="menuitem" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-brand-50">
                        <Package className="h-4 w-4" /> My orders
                      </Link>
                      {user.role === "ADMIN" ? (
                        <Link href="/admin" role="menuitem" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-brand-50">
                          <Sparkles className="h-4 w-4" /> Admin dashboard
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={logout}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="px-3 py-2 text-xs text-neutral-500">
                        Sign in to sync your cart, orders and WhatsApp.
                      </p>
                      <div className="flex gap-2 px-3 pb-2">
                        <Link href="/login" className="flex-1">
                          <Button size="sm" className="w-full">
                            Login
                          </Button>
                        </Link>
                        <Link href="/signup" className="flex-1">
                          <Button size="sm" variant="outline" className="w-full">
                            Signup
                          </Button>
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>

            <Link
              href="/cart"
              className="relative flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium text-brand-900 hover:bg-brand-50"
              aria-label={`Cart with ${count} items`}
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="hidden sm:inline">Cart</span>
              {count > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                  {count}
                </span>
              ) : null}
            </Link>
          </div>
        </div>

        {mobileOpen ? (
          <div className="border-t border-brand-100 bg-white px-3 pb-4 lg:hidden">
            <form onSubmit={submitSearch} role="search" className="py-3">
              <label htmlFor="mobile-search" className="sr-only">
                Search products
              </label>
              <Input
                id="mobile-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search aloo, tamatar, paneer…"
              />
            </form>
            <nav aria-label="Mobile" className="grid grid-cols-2 gap-2">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    setMobileOpen(false);
                    setMobileNav(false);
                  }}
                  className="rounded-xl border border-brand-100 px-3 py-2 text-sm font-medium text-brand-900 hover:bg-brand-50"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}
      </header>
    </>
  );
}

export function StoreBottomNav() {
  const count = useCartUi((s) => s.count);
  const items = [
    { href: "/", label: "Home", icon: Home },
    { href: "/vegetables", label: "Shop", icon: Leaf },
    { href: "/recipes", label: "Recipes", icon: UtensilsCrossed },
    { href: "/orders", label: "Orders", icon: Package },
    { href: "/cart", label: "Cart", icon: ShoppingCart, badge: count },
  ];
  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-brand-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {items.map((item) => (
          <li key={item.href} className="flex-1">
            <Link
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-neutral-500 hover:text-brand-700",
              )}
            >
              <span className="relative">
                <item.icon className="h-5 w-5" />
                {item.badge ? (
                  <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[9px] font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </span>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
