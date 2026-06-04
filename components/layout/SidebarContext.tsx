"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "kronosviewer-sidebar-collapsed";

type SidebarContextValue = {
  collapsed: boolean;
  mobileOpen: boolean;
  toggleCollapsed: () => void;
  openMobile: () => void;
  closeMobile: () => void;
};

const SidebarContext = createContext<SidebarContextValue | undefined>(
  undefined,
);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") setCollapsed(true);
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed, hydrated]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => !value);
  }, []);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const value = useMemo(
    () => ({
      collapsed,
      mobileOpen,
      toggleCollapsed,
      openMobile,
      closeMobile,
    }),
    [collapsed, mobileOpen, toggleCollapsed, openMobile, closeMobile],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar debe usarse dentro de SidebarProvider");
  }
  return context;
}
