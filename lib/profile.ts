import type { User } from "@supabase/supabase-js";

export type ProfileMetadata = {
  username?: string;
  full_name?: string;
  phone?: string;
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

export function avatarUrlFromProfile(nombre: string, email: string): string {
  const label = encodeURIComponent(nombre || email || "U");
  return `https://ui-avatars.com/api/?name=${label}&background=635BFF&color=fff&size=160&bold=true`;
}
