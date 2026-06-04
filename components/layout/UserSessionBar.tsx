"use client";

import { ChevronDown, Menu } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useSidebar } from "@/components/layout/SidebarContext";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  profileFromUser,
  resolveAvatarUrl,
  truncateEmail,
} from "@/lib/profile";
import { createClient } from "@/lib/supabase/client";

export function UserSessionBar() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const { openMobile } = useSidebar();

  if (loading || !user?.email) {
    return null;
  }

  const profile = profileFromUser(user);
  const displayName = profile.nombreCompleto || profile.usuario;
  const avatarUrl = resolveAvatarUrl(user, displayName, profile.correo);
  const greetingEmail = truncateEmail(user.email);

  const handleSignOut = async () => {
    setOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="shrink-0 border-b border-zinc-200 bg-zinc-50/90">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <button
          type="button"
          onClick={openMobile}
          className="rounded-lg p-2 text-zinc-700 transition hover:bg-zinc-100 md:hidden"
          aria-label="Abrir menú lateral"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-zinc-900 transition hover:bg-zinc-100"
            aria-expanded={open}
            aria-haspopup="menu"
          >
            <ProfileAvatar
              src={avatarUrl}
              alt={displayName}
              size="sm"
            />
            <span className="max-w-[220px] truncate font-medium sm:max-w-[280px]">
              Hi, {greetingEmail}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-zinc-600 transition ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>

          {open && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10"
                aria-label="Cerrar menú"
                onClick={() => setOpen(false)}
              />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 min-w-[11rem] rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
              >
                <Link
                  href="/perfil"
                  role="menuitem"
                  className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                  onClick={() => setOpen(false)}
                >
                  Perfil
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  onClick={handleSignOut}
                >
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
