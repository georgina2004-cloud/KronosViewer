"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { VersionTimeline } from "@/components/versiones/VersionTimeline";
import { createClient } from "@/lib/supabase/client";
import { downloadZipFromStorage } from "@/lib/storage";
import type { Proyecto, Version } from "@/lib/types";
import { formatFecha } from "@/lib/utils";

type PageState = "loading" | "ready" | "not-found" | "error";

export default function ProyectoHistorialPage() {
  const params = useParams<{ slug: string }>();
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

      <header className="mt-4 border-b border-zinc-200 pb-6">
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
      </header>

      <section className="mt-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Historial de versiones
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {versiones.length === 0
                ? "Aún no hay maquetas desplegadas."
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
              Despliega tu primera maqueta desde el panel de proyectos subiendo
              un archivo ZIP con{" "}
              <code className="rounded bg-zinc-100 px-1 text-xs">index.html</code>{" "}
              en la raíz.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Ir al panel de proyectos
            </Link>
          </div>
        ) : (
          <VersionTimeline
            versiones={versiones}
            downloadingId={downloadingId}
            onDownload={handleDownload}
          />
        )}
      </section>
    </div>
  );
}
