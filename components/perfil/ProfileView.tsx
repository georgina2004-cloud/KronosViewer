"use client";

import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  MoreVertical,
  Pencil,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import {
  avatarUrlFromProfile,
  profileFromUser,
  type ProfileFormValues,
} from "@/lib/profile";

const EMPTY_FORM: ProfileFormValues = {
  usuario: "",
  correo: "",
  telefono: "",
  password: "********",
  nombreCompleto: "",
};

export function ProfileView() {
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [form, setForm] = useState<ProfileFormValues>(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState<ProfileFormValues>(EMPTY_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const syncFromUser = useCallback(() => {
    const values = profileFromUser(user);
    setForm(values);
    setSavedForm(values);
    setNewPassword("");
  }, [user]);

  useEffect(() => {
    syncFromUser();
  }, [syncFromUser]);

  const displayName = form.nombreCompleto || form.usuario || "Usuario";
  const avatarUrl = avatarUrlFromProfile(displayName, form.correo);
  const firstName = displayName.split(" ")[0] ?? displayName;

  const handleCancel = () => {
    setForm(savedForm);
    setNewPassword("");
    setIsEditing(false);
    setShowPassword(false);
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const payload: {
        email?: string;
        password?: string;
        data: {
          username: string;
          full_name: string;
          phone: string;
        };
      } = {
        data: {
          username: form.usuario.trim(),
          full_name: form.nombreCompleto.trim(),
          phone: form.telefono.trim(),
        },
      };

      if (form.correo.trim() !== savedForm.correo) {
        payload.email = form.correo.trim();
      }

      if (newPassword.trim().length > 0) {
        if (newPassword.trim().length < 6) {
          throw new Error("La contraseña debe tener al menos 6 caracteres.");
        }
        payload.password = newPassword.trim();
      }

      const { error } = await supabase.auth.updateUser(payload);
      if (error) throw error;

      const nextSaved: ProfileFormValues = {
        ...form,
        correo: payload.email ?? form.correo,
        password: "********",
      };
      setSavedForm(nextSaved);
      setForm(nextSaved);
      setNewPassword("");
      setIsEditing(false);
      setShowPassword(false);
      setMessage({ type: "success", text: "Perfil actualizado correctamente." });
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "No se pudo guardar el perfil.";
      setMessage({ type: "error", text });
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof ProfileFormValues>(
    key: K,
    value: ProfileFormValues[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (authLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#F0EFFF]">
        <Loader2 className="h-8 w-8 animate-spin text-[#635BFF]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#F0EFFF] p-8">
        <p className="text-sm text-[#635BFF]/80">Inicia sesión para ver tu perfil.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F0EFFF] px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="relative overflow-hidden rounded-[2rem] bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
          {/* Encabezado */}
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#9CA3AF]">Bienvenido</p>
              <h1 className="mt-0.5 text-2xl font-semibold text-[#635BFF] sm:text-3xl">
                Hola, {firstName}
              </h1>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="rounded-full p-2 text-[#9CA3AF] transition hover:bg-[#F3F4FF] hover:text-[#635BFF]"
                aria-label="Opciones"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10"
                    aria-label="Cerrar menú"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-1 w-44 rounded-2xl border border-[#E8E6FF] bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-left text-sm text-zinc-600 hover:bg-[#F3F4FF]"
                      onClick={() => {
                        setMenuOpen(false);
                        setIsEditing(true);
                      }}
                    >
                      Editar perfil
                    </button>
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-left text-sm text-zinc-600 hover:bg-[#F3F4FF]"
                      onClick={() => {
                        setMenuOpen(false);
                        handleCancel();
                      }}
                    >
                      Descartar cambios
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Avatar y nombre */}
          <div className="mb-10 flex flex-col items-center text-center">
            <div className="relative h-28 w-28 overflow-hidden rounded-full ring-4 ring-[#F0EFFF]">
              <Image
                src={avatarUrl}
                alt={displayName}
                width={112}
                height={112}
                className="h-full w-full object-cover"
                unoptimized
              />
            </div>
            <h2 className="mt-4 text-xl font-bold text-[#635BFF]">{displayName}</h2>
            <div className="mt-2 flex gap-1" aria-label="Valoración">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`text-lg ${star <= 4 ? "text-[#635BFF]" : "text-[#E5E7EB]"}`}
                >
                  ★
                </span>
              ))}
            </div>
          </div>

          {/* Formulario */}
          <div className="relative">
            <div className="absolute -right-1 top-0 z-10 sm:right-0">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    setMessage(null);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F4FF] text-[#635BFF] transition hover:bg-[#E8E6FF]"
                  aria-label="Editar perfil"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 disabled:opacity-50"
                    aria-label="Cancelar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#635BFF] text-white transition hover:bg-[#5248e6] disabled:opacity-60"
                    aria-label="Guardar"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-5 pr-12 sm:pr-14">
              <ProfileField
                label="Usuario"
                value={form.usuario}
                onChange={(v) => updateField("usuario", v)}
                readOnly={!isEditing}
                placeholder="nombre.usuario"
              />
              <ProfileField
                label="Correo"
                type="email"
                value={form.correo}
                onChange={(v) => updateField("correo", v)}
                readOnly={!isEditing}
                placeholder="correo@empresa.com"
              />
              <ProfileField
                label="Teléfono"
                type="tel"
                value={form.telefono}
                onChange={(v) => updateField("telefono", v)}
                readOnly={!isEditing}
                placeholder="+34 600 000 000"
              />
              {isEditing ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#635BFF]">
                    Contraseña nueva
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Dejar vacío para no cambiar"
                      className="w-full rounded-full border-0 bg-[#F3F4F6] px-5 py-3 pr-12 text-sm text-zinc-800 outline-none ring-[#635BFF] focus:ring-2"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#635BFF]"
                      aria-label={
                        showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-400">
                    Solo completa si deseas cambiar tu contraseña.
                  </p>
                </div>
              ) : (
                <ProfileField
                  label="Contraseña"
                  type="password"
                  value="••••••••"
                  onChange={() => {}}
                  readOnly
                />
              )}

              {isEditing && (
                <ProfileField
                  label="Nombre completo"
                  value={form.nombreCompleto}
                  onChange={(v) => updateField("nombreCompleto", v)}
                  readOnly={false}
                  placeholder="Tu nombre visible"
                />
              )}
            </div>
          </div>

          {message && (
            <p
              className={`mt-6 rounded-2xl px-4 py-3 text-sm ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {message.text}
            </p>
          )}

          {isEditing && (
            <div className="mt-8 flex flex-wrap justify-end gap-3 sm:hidden">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="rounded-full border border-zinc-200 px-6 py-2.5 text-sm font-medium text-zinc-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-[#635BFF] px-6 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type ProfileFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  type?: string;
  placeholder?: string;
};

function ProfileField({
  label,
  value,
  onChange,
  readOnly = false,
  type = "text",
  placeholder,
}: ProfileFieldProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[#635BFF]">
        {label}:
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        className={[
          "w-full rounded-full border-0 px-5 py-3 text-sm text-zinc-800 outline-none transition",
          readOnly
            ? "cursor-default bg-[#F3F4F6] text-zinc-600"
            : "bg-[#F3F4F6] ring-[#635BFF] focus:ring-2",
        ].join(" ")}
      />
    </div>
  );
}
