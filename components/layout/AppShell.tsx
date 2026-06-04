"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import {
  SidebarProvider,
  useSidebar,
} from "@/components/layout/SidebarContext";
import { UserSessionBar } from "@/components/layout/UserSessionBar";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { mobileOpen, closeMobile } = useSidebar();

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          aria-label="Cerrar menú lateral"
          onClick={closeMobile}
        />
      )}
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <UserSessionBar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppShellInner>{children}</AppShellInner>
    </SidebarProvider>
  );
}
