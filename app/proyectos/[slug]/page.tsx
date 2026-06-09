"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { VersionTimeline } from "@/components/versiones/VersionTimeline";
import { createClient } from "@/lib/supabase/client";
import { downloadZipFromStorage } from "@/lib/storage";
import type { Proyecto, Version } from "@/lib/types";
import { formatFecha } from "@/lib/utils";
import { uploadProjectVersion } from "@/lib/upload/client";

type PageState = "loading" | "ready" | "not-found" | "error";

export default function ProyectoHistorialPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = useMemo(() => {
    const raw = params?.slug;
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  }, [params]);

  const supabase = useMemo(() => createClient(), []);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [versiones, setVersiones] = useState<Version[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [versionTag, setVersionTag] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cargarDatos = useCallback(async () => {
    if (!slug) {
      setPageState("not-found");
      return;
    }

    setPageState("loading");
    setErrorMessage(null);

    const { data: proyectoData, error: proyectoError } = await supabase
      .from("proyectos")
      .select("id, nombre, slug, descripcion, fecha_creacion")
      .eq("slug", slug)
      .maybeSingle();

    if (proyectoError) {
      setErrorMessage(proyectoError.message);
      setPageState("error");
      return;
    }

    if (!proyectoData) {
      setPageState("not-found");
      return;
    }

    const { data: versionesData, error: versionesError } = await supabase
      .from("versiones")
      .select(
        "id, proyecto_id, version_tag, ruta_visor, ruta_zip_storage, fecha_subida",
      )
      .eq("proyecto_id", proyectoData.id)
      .order("fecha_subida", { ascending: false });

    if (versionesError) {
      setErrorMessage(versionesError.message);
      setPageState("error");
      return;
    }

    setProyecto(proyectoData as Proyecto);
    setVersiones((versionesData ?? []) as Version[]);
    setPageState("ready");
  }, [slug, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarDatos();
  }, [cargarDatos]);

  const handleDownload = async (version: Version) => {
    if (!version.ruta_zip_storage) {
      alert("No hay ruta de respaldo para esta versión.");
      return;
    }

    setDownloadingId(version.id);
    try {
      await downloadZipFromStorage(
        supabase,
        version.ruta_zip_storage,
        `${version.version_tag}.zip`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error al descargar el ZIP";
      alert(message);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleZipUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!proyecto) return;

    if (!versionTag.trim() || !zipFile) {
      setUploadMessage({
        type: "error",
        text: "Indica el tag de versión y selecciona un archivo ZIP.",
      });
      return;
    }

    setUploading(true);
    setUploadMessage(null);

    try {
      await uploadProjectVersion({
        supabase,
        proyectoId: proyecto.id,
        versionTag: versionTag.trim(),
        zipFile,
        onProgress: (text) => setUploadMessage({ type: "success", text }),
      });

      setUploadMessage({
        type: "success",
        text: "¡Versión desplegada y respaldada con éxito!",
      });
      setVersionTag("");
      setZipFile(null);
      const fileInput = document.getElementById(
        "zip-input",
      ) as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      await cargarDatos();
    } catch (error) {
      setUploadMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Error al subir el archivo ZIP.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteProyecto = async () => {
    if (!proyecto) return;

    setDeleting(true);
    try {
      const response = await fetch("/api/proyectos/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proyectoId: proyecto.id }),
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar el proyecto.");
      }

      router.push("/dashboard");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Error al eliminar el proyecto.",
      );
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (pageState === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm">Cargando historial del proyecto…</p>
        </div>
      </div>
    );
  }

  if (pageState === "not-found") {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <h1 className="text-xl font-semibold text-zinc-900">
          Proyecto no encontrado
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          No existe un proyecto con el slug «{slug}».
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          ← Volver a proyectos
        </Link>
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <h1 className="text-xl font-semibold text-red-700">
          Error al cargar el proyecto
        </h1>
        <p className="mt-2 text-sm text-zinc-600">{errorMessage}</p>
        <button
          type="button"
          onClick={cargarDatos}
          className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!proyecto) return null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 sm:px-8">
      <Link
        href="/dashboard"
        className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
      >
        ← Volver a proyectos
      </Link>

      <header className="mt-4 flex items-start justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-indigo-600">
            /{proyecto.slug}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">
            {proyecto.nombre}
          </h1>
          {proyecto.descripcion && (
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              {proyecto.descripcion}
            </p>
          )}
          <p className="mt-3 text-xs text-zinc-400">
            Creado el {formatFecha(proyecto.fecha_creacion)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
        >
          <TrashIcon className="h-4 w-4" />
          Eliminar proyecto
        </button>
      </header>

      {/* SUBIR NUEVA VERSIÓN */}
      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          Subir nueva versión
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Solo necesitas el archivo ZIP del prototipo y el tag de la versión.
        </p>

        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <p className="font-medium">¿Tu prototipo usa un framework (React, Vite, Next, Angular…)?</p>
          <p className="mt-1">
            Compílalo antes con{" "}
            <code className="rounded bg-amber-100 px-1">npm install &amp;&amp; npm run build</code>{" "}
            y sube un ZIP que incluya la carpeta generada (
            <code className="rounded bg-amber-100 px-1">dist</code>,{" "}
            <code className="rounded bg-amber-100 px-1">build</code> u{" "}
            <code className="rounded bg-amber-100 px-1">out</code>), o comprime
            directamente el contenido de esa carpeta. Los sitios HTML estáticos
            (con <code className="rounded bg-amber-100 px-1">index.html</code> en
            la raíz) se suben tal cual.
          </p>
          <p className="mt-1">
            En Next.js, <code className="rounded bg-amber-100 px-1">.next</code>{" "}
            no es una salida estática para el visor: genera y sube{" "}
            <code className="rounded bg-amber-100 px-1">out</code> usando export
            estático.
          </p>
        </div>

        <form
          onSubmit={handleZipUpload}
          className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Tag de Versión (Ej: v1.0.0)
            </label>
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
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Archivo Prototipo (.zip)
            </label>
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
            <p
              className={`sm:col-span-2 whitespace-pre-line rounded-lg px-3 py-2 text-sm ${
                uploadMessage.type === "success"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {uploadMessage.text}
            </p>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={uploading}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-60 sm:w-auto sm:px-6"
            >
              {uploading
                ? "Procesando y Desplegando..."
                : "Subir y Renderizar Prototipo"}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Historial de versiones
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {versiones.length === 0
                ? "Aún no hay prototipos desplegados."
                : `${versiones.length} versión${versiones.length === 1 ? "" : "es"} registrada${versiones.length === 1 ? "" : "s"}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={cargarDatos}
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-white"
          >
            Actualizar
          </button>
        </div>

        {versiones.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <svg
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <h3 className="text-base font-medium text-zinc-800">
              Sin versiones todavía
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">
              Despliega tu primer prototipo con el formulario de arriba subiendo
              un archivo ZIP con{" "}
              <code className="rounded bg-zinc-100 px-1 text-xs">index.html</code>{" "}
              en la raíz.
            </p>
          </div>
        ) : (
          <VersionTimeline
            versiones={versiones}
            downloadingId={downloadingId}
            onDownload={handleDownload}
          />
        )}
      </section>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">
              Eliminar proyecto
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              Se eliminarán «{proyecto.nombre}», todas sus versiones y los
              archivos desplegados. Esta acción no se puede deshacer.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteProyecto}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deleting ? "Eliminando..." : "Eliminar"}
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
