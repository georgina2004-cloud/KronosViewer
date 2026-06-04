import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET_PRIVADO } from "@/lib/utils";

export async function downloadZipFromStorage(
  supabase: SupabaseClient,
  rutaZipStorage: string,
  filename: string,
): Promise<void> {
  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET_PRIVADO)
    .createSignedUrl(rutaZipStorage, 3600);

  if (!signError && signed?.signedUrl) {
    triggerBrowserDownload(signed.signedUrl, filename);
    return;
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(BUCKET_PRIVADO)
    .download(rutaZipStorage);

  if (downloadError || !blob) {
    throw new Error(
      downloadError?.message ??
        signError?.message ??
        "No se pudo descargar el archivo ZIP",
    );
  }

  const objectUrl = URL.createObjectURL(blob);
  triggerBrowserDownload(objectUrl, filename);
  URL.revokeObjectURL(objectUrl);
}

function triggerBrowserDownload(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
