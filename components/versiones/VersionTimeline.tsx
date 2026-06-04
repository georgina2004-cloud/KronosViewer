"use client";

import type { Version } from "@/lib/types";
import { formatFecha } from "@/lib/utils";

type VersionTimelineProps = {
  versiones: Version[];
  downloadingId: string | null;
  onDownload: (version: Version) => void;
};

export function VersionTimeline({
  versiones,
  downloadingId,
  onDownload,
}: VersionTimelineProps) {
  return (
    <ol className="relative ml-2 border-l-2 border-indigo-100 pl-8">
      {versiones.map((version, index) => (
        <li key={version.id} className="relative mb-8 last:mb-0">
          <span
            className={`absolute -left-[2.15rem] top-1 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-zinc-50 ${
              index === 0 ? "bg-indigo-600" : "bg-zinc-300"
            }`}
            aria-hidden
          />

          <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                  {version.version_tag}
                </span>
                <p className="text-sm text-zinc-500">
                  Subida el {formatFecha(version.fecha_subida)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href={version.ruta_visor}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                >
                  Ver Maqueta
                </a>
                <button
                  type="button"
                  onClick={() => onDownload(version)}
                  disabled={downloadingId === version.id}
                  className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloadingId === version.id
                    ? "Descargando…"
                    : "Descargar ZIP"}
                </button>
              </div>
            </div>
          </article>
        </li>
      ))}
    </ol>
  );
}
