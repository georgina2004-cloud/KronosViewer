import type { User } from "@supabase/supabase-js";

export type ProfileMetadata = {
  username?: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
};

export type ProfileFormValues = {
  usuario: string;
  correo: string;
  telefono: string;
  password: string;
  nombreCompleto: string;
};

export function profileFromUser(user: User | null): ProfileFormValues {
  const meta = (user?.user_metadata ?? {}) as ProfileMetadata;
  const email = user?.email ?? "";
  const fullName = meta.full_name?.trim() || "";
  const username =
    meta.username?.trim() ||
    email.split("@")[0] ||
    "usuario";

  return {
    usuario: username,
    correo: email,
    telefono: meta.phone?.trim() ?? "",
    password: "********",
    nombreCompleto: fullName || username,
  };
}

export function avatarUrlFromProfile(
  nombre: string,
  email: string,
  avatarUrl?: string | null,
): string {
  if (avatarUrl?.trim()) return avatarUrl.trim();
  const label = encodeURIComponent(nombre || email || "U");
  return `https://ui-avatars.com/api/?name=${label}&background=635BFF&color=fff&size=160&bold=true`;
}

export function resolveAvatarUrl(
  user: User | null,
  nombre: string,
  email: string,
): string {
  const meta = (user?.user_metadata ?? {}) as ProfileMetadata;
  return avatarUrlFromProfile(nombre, email, meta.avatar_url);
}

export function truncateEmail(email: string, maxLength = 28): string {
  if (email.length <= maxLength) return email;
  return `${email.slice(0, maxLength - 3)}...`;
}
