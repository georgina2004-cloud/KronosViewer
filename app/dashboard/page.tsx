"use client";

import { useState, useEffect, FormEvent, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { slugifyNombre } from "@/lib/utils";

interface Proyecto {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  fecha_creacion: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();

  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const cargarProyectos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("proyectos")
        .select("id, nombre, slug, descripcion, fecha_creacion")
        .order("fecha_creacion", { ascending: false });

      if (error) throw error;
      setProyectos(data || []);
    } catch (error: unknown) {
      console.error(
        "Error al cargar proyectos:",
        getErrorMessage(error, "Error desconocido"),
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarProyectos();
  }, [cargarProyectos]);

  const handleCreateProyecto = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!user) {
      setFormError("Debes iniciar sesión para crear proyectos.");
      return;
    }

    setCreating(true);

    const baseSlug = slugifyNombre(nombre) || "proyecto";

    try {
      // El slug es único de forma global (se usa como ruta en Storage), así que
      // si choca con otro se reintenta con un sufijo corto.
      let lastError: string | null = null;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const slug =
          attempt === 0
            ? baseSlug
            : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

        const { error } = await supabase.from("proyectos").insert([
          {
            nombre: nombre.trim(),
            slug,
            descripcion: descripcion.trim() || null,
            user_id: user.id,
          },
        ]);

        if (!error) {
          lastError = null;
          break;
        }

        // 23505 = unique_violation (slug duplicado): reintentar con sufijo.
        if (error.code === "23505") {
          lastError = error.message;
          continue;
        }

        throw error;
      }

      if (lastError) {
        throw new Error(
          "No se pudo generar un identificador único para el proyecto. Inténtalo de nuevo.",
        );
      }

      setNombre("");
      setDescripcion("");
      setShowModal(false);
      await cargarProyectos();
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, "Error al crear el proyecto."));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch("/api/proyectos/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proyectoId: id }),
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar el proyecto.");
      }

      setProyectos((prev) => prev.filter((p) => p.id !== id));
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Error al eliminar el proyecto."));
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  return (
    <div className="text-zinc-900">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Mis Proyectos</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Solo tú puedes ver y gestionar estos proyectos.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
          >
            Nuevo Proyecto
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm text-zinc-500">
            Cargando proyectos...
          </div>
        ) : proyectos.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-12 text-center text-zinc-500">
            No hay proyectos creados todavía. ¡Crea el primero para empezar!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {proyectos.map((proyecto) => (
              <div
                key={proyecto.id}
                onClick={() => router.push(`/proyectos/${proyecto.slug}`)}
                className="group relative flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm hover:shadow-md cursor-pointer transition-all"
              >
                <button
                  type="button"
                  title="Eliminar proyecto"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmId(proyecto.id);
                  }}
                  className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>

                <div>
                  <h3 className="pr-6 text-base font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors">
                    {proyecto.nombre}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400 font-mono">
                    /{proyecto.slug}
                  </p>
                  <p className="mt-3 text-sm text-zinc-500 line-clamp-2">
                    {proyecto.descripcion || "Sin descripción disponible."}
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between text-xs text-zinc-400">
                  <span>
                    {new Date(proyecto.fecha_creacion).toLocaleDateString()}
                  </span>
                  <span className="font-medium text-indigo-600 group-hover:underline">
                    Ver historial →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL CREAR PROYECTO */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-semibold text-zinc-900 mb-4">
              Crear Nuevo Proyecto
            </h3>

            <form onSubmit={handleCreateProyecto} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Nombre del Proyecto
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Cliente BCM Baking"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Breve descripción técnica o detalles del cliente..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  {formError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormError(null);
                  }}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
                >
                  {creating ? "Creando..." : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINACIÓN */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">
              Eliminar proyecto
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              Se eliminarán el proyecto, todas sus versiones y los archivos
              desplegados. Esta acción no se puede deshacer.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                disabled={deletingId !== null}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmId)}
                disabled={deletingId !== null}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deletingId ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}
