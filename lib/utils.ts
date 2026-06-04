export function slugifyNombre(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

const MIME_BY_EXT: Record<string, string> = {
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".map": "application/json",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".pdf": "application/pdf",
  ".wasm": "application/wasm",
};

export function mimeFromPath(path: string): string {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

export const BUCKET_PUBLICO = "sitios-desplegados";
export const BUCKET_PRIVADO = "respaldos-zips";
export const BUCKET_AVATARS = "avatars";

export function publicStorageUrl(
  objectPath: string,
  bucket: string = BUCKET_PUBLICO,
): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL no está configurada");
  }
  const encoded = objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
}

export function publicAvatarUrl(objectPath: string): string {
  return publicStorageUrl(objectPath, BUCKET_AVATARS);
}

// Ruta interna del visor que sirve el sitio con el Content-Type correcto.
// Supabase Storage entrega los HTML públicos como text/plain (política
// anti-phishing), así que NO se puede enlazar directo al objeto público:
// el navegador mostraría el código en vez de renderizar el sitio.
export function viewerPathForObject(objectPath: string): string {
  const normalized = objectPath.replace(/\/index\.html?$/i, "");
  const encoded = objectPath
    .replace(/\/index\.html?$/i, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return normalized ? `/visor/${encoded}` : "/visor";
}

// Convierte una `ruta_visor` almacenada (que puede ser una URL pública
// antigua de Supabase o ya una ruta /visor) a la ruta del visor interno.
export function toViewerUrl(rutaVisor: string): string {
  if (!rutaVisor) return rutaVisor;
  if (rutaVisor.startsWith("/visor/")) return rutaVisor;

  const marker = `/storage/v1/object/public/${BUCKET_PUBLICO}/`;
  const index = rutaVisor.indexOf(marker);
  if (index >= 0) {
    return `/visor/${rutaVisor.slice(index + marker.length)}`;
  }

  return rutaVisor;
}
