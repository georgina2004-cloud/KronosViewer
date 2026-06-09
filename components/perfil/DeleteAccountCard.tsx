"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function DeleteAccountCard() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "¿Estás absolutamente seguro de que deseas eliminar tu cuenta permanentemente? Se borrarán todos tus proyectos, versiones de prototipos y tokens de acceso. Esta acción es irreversible."
    );

    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/profile/delete", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ocurrió un error al eliminar la cuenta.");
      }

      // Cerrar sesión localmente en Supabase y redirigir al login
      const supabase = createClient();
      await supabase.auth.signOut();
      
      router.push("/login");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar la cuenta.");
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#F0EFFF] px-4 pb-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[2rem] border border-red-100 bg-white px-6 py-8 shadow-sm sm:px-10">
          <div className="mb-2 flex items-center gap-2 text-red-600">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-semibold">
              Zona de peligro: Eliminar cuenta
            </h2>
          </div>
          <p className="mb-6 text-sm text-zinc-500">
            Una vez que elimines tu cuenta, no habrá marcha atrás. Se eliminarán permanentemente todos tus datos, proyectos cargados, archivos de previsualización y tokens de API de nuestros servidores.
          </p>

          {error && (
            <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 active:bg-red-800 disabled:opacity-60 cursor-pointer shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Eliminando cuenta…
                </>
              ) : (
                "Eliminar cuenta permanentemente"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
