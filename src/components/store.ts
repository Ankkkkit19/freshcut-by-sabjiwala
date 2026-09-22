"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Zustand holds *UI cache only*. The database cart remains the source of truth:
 * every mutation is followed by a server refresh of the quote.
 */
type CartUiState = {
  count: number;
  pendingItemIds: number[];
  lastAdded: string | null;
  setCount: (count: number) => void;
  markPending: (itemId: number, pending: boolean) => void;
  isPending: (itemId: number) => boolean;
  setLastAdded: (label: string | null) => void;
};

export const useCartUi = create<CartUiState>()((set, get) => ({
  count: 0,
  pendingItemIds: [],
  lastAdded: null,
  setCount: (count) => set({ count }),
  markPending: (itemId, pending) =>
    set((state) => ({
      pendingItemIds: pending
        ? [...state.pendingItemIds, itemId]
        : state.pendingItemIds.filter((id) => id !== itemId),
    })),
  isPending: (itemId) => get().pendingItemIds.includes(itemId),
  setLastAdded: (label) => set({ lastAdded: label }),
}));

type UiState = {
  mobileNavOpen: boolean;
  searchOpen: boolean;
  sidebarCollapsed: boolean;
  setMobileNav: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  toggleSidebar: () => void;
};

export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      mobileNavOpen: false,
      searchOpen: false,
      sidebarCollapsed: false,
      setMobileNav: (open) => set({ mobileNavOpen: open }),
      setSearchOpen: (open) => set({ searchOpen: open }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
    }),
    { name: "freshcut-ui", partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }) as never },
  ),
);
