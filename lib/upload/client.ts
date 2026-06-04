import type { SupabaseClient } from "@supabase/supabase-js";
import { slimZipFile } from "@/lib/upload/slimZip";
import { BUCKET_PRIVADO } from "@/lib/utils";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export type UploadVersionParams = {
  supabase: SupabaseClient;
  proyectoId: string;
  versionTag: string;
  zipFile: File;
  onProgress?: (message: string) => void;
};

// Flujo de subida de una versión: optimiza el ZIP, lo sube directo a Storage
// con una URL firmada y dispara el procesamiento/despliegue en el servidor.
export async function uploadProjectVersion({
  supabase,
  proyectoId,
  versionTag,
  zipFile,
  onProgress,
}: UploadVersionParams): Promise<void> {
  const tag = versionTag.trim();
  const notify = (message: string) => onProgress?.(message);

  notify("Optimizando ZIP (quitando node_modules y carpetas de build)...");
  const slim = await slimZipFile(zipFile);
  const uploadBlob = slim.blob;

  if (uploadBlob.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Incluso tras quitar node_modules/.next/.git, el ZIP pesa ${formatMb(
        uploadBlob.size,
      )} y supera el límite de 50 MB de Supabase Storage. Sube el límite en Supabase → Storage → Settings (requiere plan Pro) o reduce el contenido del proyecto.`,
    );
  }

  notify("Preparando subida segura...");
  const signed = await postJson<{ path: string; token: string }>(
    "/api/upload/sign",
    {
      proyectoId,
      versionTag: tag,
      fileName: zipFile.name,
      fileSize: uploadBlob.size,
    },
  );

  notify(
    slim.removedHeavyDirs
      ? `Subiendo ZIP optimizado (${formatMb(slim.originalSize)} → ${formatMb(
          uploadBlob.size,
        )})...`
      : "Subiendo ZIP a Storage...",
  );
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

  notify("Procesando y desplegando...");
  await postJson("/api/upload", {
    proyectoId,
    versionTag: tag,
    zipStoragePath: signed.path,
    zipFileName: zipFile.name,
  });
}
