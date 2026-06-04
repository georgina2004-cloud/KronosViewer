"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSidebar } from "@/components/layout/SidebarContext";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";

function navClass(active: boolean, collapsed: boolean) {
  const base = collapsed
    ? "flex items-center justify-center rounded-lg p-2.5 text-sm font-medium transition-colors"
    : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors";

  return [
    base,
    active
      ? "bg-indigo-600 text-white shadow-sm"
      : "text-zinc-300 hover:bg-zinc-800 hover:text-white",
  ].join(" ");
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile } = useSidebar();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isProyectosActive =
    pathname === "/dashboard" || pathname.startsWith("/proyectos");
  const isPerfilActive = pathname === "/perfil";

  const showLabels = !collapsed || mobileOpen;
  const isCollapsedView = collapsed && !mobileOpen;

  return (
    <aside
      className={[
        "flex h-full shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-100 transition-[width,transform] duration-300 ease-in-out",
        isCollapsedView ? "w-[4.5rem]" : "w-64",
        "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:w-64 max-md:shadow-2xl",
        mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full",
      ].join(" ")}
      aria-label="Navegación principal"
    >
      <div
        className={[
          "flex border-b border-zinc-800",
          isCollapsedView ? "flex-col items-center gap-2 px-2 py-4" : "items-start justify-between gap-2 px-4 py-5",
        ].join(" ")}
      >
        <Link
          href="/dashboard"
          className={[
            "min-w-0 transition-opacity hover:opacity-90",
            isCollapsedView ? "flex justify-center" : "block flex-1",
          ].join(" ")}
          onClick={closeMobile}
          title="KronosViewer"
        >
          {showLabels ? (
            <>
              <span className="text-lg font-semibold tracking-tight text-white">
                Kronos
                <span className="text-indigo-400">Viewer</span>
              </span>
              <p className="mt-1 text-xs text-zinc-500">Despliegue de prototipos</p>
            </>
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
              KV
            </span>
          )}
        </Link>

        <button
          type="button"
          onClick={() => {
            if (mobileOpen) closeMobile();
            else toggleCollapsed();
          }}
          className="shrink-0 rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          aria-label={
            mobileOpen
              ? "Cerrar menú lateral"
              : collapsed
                ? "Expandir menú lateral"
                : "Contraer menú lateral"
          }
          title={mobileOpen ? "Cerrar menú" : collapsed ? "Expandir menú" : "Contraer menú"}
        >
          {mobileOpen || !collapsed ? (
            <PanelLeftClose className="h-5 w-5" />
          ) : (
            <PanelLeftOpen className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav
        className={[
          "flex-1 space-y-1 py-4",
          isCollapsedView ? "px-2" : "px-3",
        ].join(" ")}
      >
        <Link
          href="/dashboard"
          className={navClass(isProyectosActive, isCollapsedView)}
          aria-current={isProyectosActive ? "page" : undefined}
          title="Proyectos"
          onClick={closeMobile}
        >
          <ProjectsIcon className="h-5 w-5 shrink-0" />
          {showLabels && <span>Proyectos</span>}
        </Link>

        <div
          className={[
            "my-4 border-t border-zinc-800",
            isCollapsedView ? "mx-1" : "",
          ].join(" ")}
        />

        <Link
          href="/perfil"
          className={`relative ${navClass(isPerfilActive, isCollapsedView)}`}
          aria-current={isPerfilActive ? "page" : undefined}
          title={user?.email ?? "Perfil"}
          onClick={closeMobile}
        >
          {isPerfilActive && !isCollapsedView && (
            <span
              className="absolute -right-3 top-1/2 h-8 w-1 -translate-y-1/2 rounded-l-full bg-indigo-400"
              aria-hidden
            />
          )}
          <ProfileIcon className="h-5 w-5 shrink-0" />
          {showLabels && (
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">Perfil</p>
              <p className="truncate text-xs font-normal text-zinc-400">
                {user?.email ?? "Sin sesión"}
              </p>
            </div>
          )}
        </Link>
      </nav>

      <div
        className={[
          "border-t border-zinc-800 p-3",
          isCollapsedView ? "px-2" : "",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={handleSignOut}
          title="Cerrar sesión"
          className={[
            "flex w-full items-center rounded-lg border border-zinc-700 text-sm font-medium text-zinc-200 transition hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-200",
            isCollapsedView
              ? "justify-center p-2.5"
              : "justify-center gap-2 px-3 py-2.5",
          ].join(" ")}
        >
          <LogoutIcon className="h-4 w-4 shrink-0" />
          {showLabels && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}

function ProjectsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
