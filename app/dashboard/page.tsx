"use client";

import {
  useState,
  useEffect,
  FormEvent,
  useCallback,
  useMemo,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { BUCKET_PRIVADO } from "@/lib/utils";
import { slimZipFile } from "@/lib/upload/slimZip";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Proyecto {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string;
  fecha_creacion: string;
}

type ApiResult<T> = T & { error?: string };

async function postJson<T>(
  url: string,
  body: Record<string, unknown>,
): Promise<ApiResult<T>> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });

  const raw = await response.text();
  let result: ApiResult<T> = {} as ApiResult<T>;
  try {
    result = raw ? (JSON.parse(raw) as ApiResult<T>) : result;
  } catch {
    result = {} as ApiResult<T>;
  }

  if (!response.ok) {
    const friendly =
      response.status === 413
        ? "El archivo ZIP es demasiado grande para enviarse a Vercel. Intenta subirlo de nuevo con el flujo directo a Storage."
        : response.status === 504 || response.status === 502
          ? "El servidor tardó demasiado en procesar el ZIP (posible build largo). Inténtalo de nuevo."
          : undefined;
    throw new Error(
      result.error ||
        friendly ||
        (raw && raw.length < 300 ? raw.trim() : "") ||
        `Error ${response.status} al procesar el archivo.`,
    );
  }

  return result;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Estados para el formulario de nuevo proyecto
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Estados para la carga del ZIP
  const [selectedProyectoId, setSelectedProyectoId] = useState("");
  const [versionTag, setVersionTag] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const cargarProyectos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("proyectos")
        .select("*")
        .order("fecha_creacion", { ascending: false });

      if (error) throw error;
      setProyectos(data || []);
      if (data && data.length > 0) setSelectedProyectoId(data[0].id);
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
    // Carga inicial del dashboard desde Supabase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarProyectos();
  }, [cargarProyectos]);

  const handleCreateProyecto = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setCreating(true);

    const slug = nombre
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");

    try {
      const { error } = await supabase
        .from("proyectos")
        .insert([{ nombre: nombre.trim(), slug, descripcion: descripcion.trim() }]);

      if (error) throw error;

      setNombre("");
      setDescripcion("");
      setShowModal(false);
      await cargarProyectos();
    } catch (error: unknown) {
      setFormError(
        getErrorMessage(
          error,
          "Error al crear el proyecto. Quizá el nombre ya existe.",
        ),
      );
    } finally {
      setCreating(false);
    }
  };

  const handleZipUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProyectoId || !versionTag || !zipFile) {
      setUploadMessage({ type: "error", text: "Por favor, completa todos los campos del formulario." });
      return;
    }

    setUploading(true);
    setUploadMessage(null);

    try {
      setUploadMessage({
        type: "success",
        text: "Optimizando ZIP (quitando node_modules y carpetas de build)...",
      });
      const slim = await slimZipFile(zipFile);
      const uploadBlob = slim.blob;

      if (uploadBlob.size > MAX_UPLOAD_BYTES) {
        throw new Error(
          `Incluso tras quitar node_modules/.next/.git, el ZIP pesa ${formatMb(
            uploadBlob.size,
          )} y supera el límite de 50 MB de Supabase Storage. Sube el límite en Supabase → Storage → Settings (requiere plan Pro) o reduce el contenido del proyecto.`,
        );
      }

      setUploadMessage({ type: "success", text: "Preparando subida segura..." });
      const signed = await postJson<{ path: string; token: string }>(
        "/api/upload/sign",
        {
          proyectoId: selectedProyectoId,
          versionTag: versionTag.trim(),
          fileName: zipFile.name,
          fileSize: uploadBlob.size,
        },
      );

      setUploadMessage({
        type: "success",
        text: slim.removedHeavyDirs
          ? `Subiendo ZIP optimizado (${formatMb(slim.originalSize)} → ${formatMb(
              uploadBlob.size,
            )})...`
          : "Subiendo ZIP a Storage...",
      });
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_PRIVADO)
        .uploadToSignedUrl(signed.path, signed.token, uploadBlob, {
          contentType: "application/zip",
        });

      if (uploadError) {
        const tooLarge = /exceeded the maximum allowed size/i.test(
          uploadError.message,
        );
        throw new Error(
          tooLarge
            ? "El ZIP supera el límite de 50 MB de Supabase Storage. Sube el límite en Supabase → Storage → Settings (requiere plan Pro)."
            : uploadError.message,
        );
      }

      setUploadMessage({ type: "success", text: "Procesando y desplegando..." });
      await postJson("/api/upload", {
        proyectoId: selectedProyectoId,
        versionTag: versionTag.trim(),
        zipStoragePath: signed.path,
        zipFileName: zipFile.name,
      });

      setUploadMessage({ type: "success", text: "¡Versión desplegada y respaldada con éxito!" });
      setVersionTag("");
      setZipFile(null);
      // Limpiar el input file nativo
      const fileInput = document.getElementById("zip-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (error: unknown) {
      setUploadMessage({
        type: "error",
        text: getErrorMessage(
          error,
          "Error de red al intentar subir el archivo.",
        ),
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="text-zinc-900">
      <div className="mx-auto max-w-7xl px-6 py-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* PANEL IZQUIERDO: CARGAR NUEVA MAQUETA ZIP */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm h-fit">
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">Desplegar Maqueta HTML</h2>
          
          {proyectos.length === 0 ? (
            <p className="text-sm text-zinc-500">Debes crear al menos un proyecto antes de poder subir una maqueta ZIP.</p>
          ) : (
            <form onSubmit={handleZipUpload} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Seleccionar Proyecto</label>
                <select
                  value={selectedProyectoId}
                  onChange={(e) => setSelectedProyectoId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
                >
                  {proyectos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Tag de Versión (Ej: v1.0.0)</label>
                <input
                  type="text"
                  required
                  placeholder="v1.0.0"
                  value={versionTag}
                  onChange={(e) => setVersionTag(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Archivo Maqueta (.zip)</label>
                <input
                  id="zip-input"
                  type="file"
                  required
                  accept=".zip"
                  onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              {uploadMessage && (
                <p className={`rounded-lg px-3 py-2 text-sm ${uploadMessage.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {uploadMessage.text}
                </p>
              )}

              <button
                type="submit"
                disabled={uploading}
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {uploading ? "Procesando y Desplegando..." : "Subir y Renderizar Maqueta"}
              </button>
            </form>
          )}
        </div>

        {/* PANEL DERECHO: LISTADO DE PROYECTOS */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-zinc-900">Proyectos Activos</h2>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
            >
              Nuevo Proyecto
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-sm text-zinc-500">Cargando proyectos...</div>
          ) : proyectos.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-12 text-center text-zinc-500">
              No hay proyectos creados todavía. ¡Crea el primero para empezar!
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {proyectos.map((proyecto) => (
                <div
                  key={proyecto.id}
                  onClick={() => router.push(`/proyectos/${proyecto.slug}`)}
                  className="group relative flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm hover:shadow-md cursor-pointer transition-all"
                >
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors">
                      {proyecto.nombre}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-400 font-mono">/{proyecto.slug}</p>
                    <p className="mt-3 text-sm text-zinc-500 line-clamp-2">{proyecto.descripcion || "Sin descripción disponible."}</p>
                  </div>
                  <div className="mt-6 flex items-center justify-between text-xs text-zinc-400">
                    <span>{new Date(proyecto.fecha_creacion).toLocaleDateString()}</span>
                    <span className="font-medium text-indigo-600 group-hover:underline">Ver historial →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL CREAR PROYECTO */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-semibold text-zinc-900 mb-4">Crear Nuevo Proyecto</h3>
            
            <form onSubmit={handleCreateProyecto} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Nombre del Proyecto</label>
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
                <label className="mb-1 block text-sm font-medium text-zinc-700">Descripción (Opcional)</label>
                <textarea
                  rows={3}
                  placeholder="Breve descripción técnica o detalles del cliente..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
                />
              </div>

              {formError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}

              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setFormError(null); }}
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
    </div>
  );
}