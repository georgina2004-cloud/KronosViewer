"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";

function navClass(active: boolean, disabled?: boolean) {
  if (disabled) {
    return "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-500 cursor-not-allowed opacity-60";
  }
  return [
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isProyectosActive =
    pathname === "/dashboard" || pathname.startsWith("/proyectos");
  const isPerfilActive = pathname === "/perfil";

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-100">
      <div className="border-b border-zinc-800 px-5 py-6">
        <Link href="/dashboard" className="block">
          <span className="text-lg font-semibold tracking-tight text-white">
            Kronos
            <span className="text-indigo-400">Viewer</span>
          </span>
          <p className="mt-1 text-xs text-zinc-500">Despliegue de maquetas</p>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <Link
          href="/dashboard"
          className={navClass(isProyectosActive)}
          aria-current={isProyectosActive ? "page" : undefined}
        >
          <ProjectsIcon className="h-5 w-5 shrink-0" />
          Proyectos
        </Link>

        <span
          className={navClass(false, true)}
          title="Módulo en desarrollo"
        >
          <HistoryIcon className="h-5 w-5 shrink-0" />
          Historial Global
          <span className="ml-auto rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
            Pronto
          </span>
        </span>

        <div className="my-4 border-t border-zinc-800" />

        <Link
          href="/perfil"
          className={`relative ${navClass(isPerfilActive)}`}
          aria-current={isPerfilActive ? "page" : undefined}
        >
          {isPerfilActive && (
            <span
              className="absolute -right-3 top-1/2 h-8 w-1 -translate-y-1/2 rounded-l-full bg-indigo-400"
              aria-hidden
            />
          )}
          <ProfileIcon className="h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">Perfil</p>
            <p className="truncate text-xs font-normal text-zinc-400">
              {user?.email ?? "Sin sesión"}
            </p>
          </div>
        </Link>
      </nav>

      <div className="border-t border-zinc-800 p-3">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-200"
        >
          <LogoutIcon className="h-4 w-4" />
          Cerrar sesión
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

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
