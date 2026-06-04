import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_PUBLICO, mimeFromPath } from "@/lib/utils";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path?: string[] }> };

export async function GET(_request: Request, context: RouteContext) {
  const { path } = await context.params;
  const segments = (path ?? []).map((segment) => safeDecode(segment));

  if (segments.length === 0) {
    return new Response("Ruta inválida", { status: 400 });
  }

  if (segments.some((segment) => segment === "..")) {
    return new Response("Ruta inválida", { status: 400 });
  }

  const admin = createAdminClient();
  const found = await downloadObject(admin, segments);

  if (!found) {
    return new Response("Archivo no encontrado", { status: 404 });
  }

  const { buffer, objectPath } = found;
  // La raíz del despliegue siempre es `${slug}/${versionTag}`.
  const siteRoot = `/visor/${segments
    .slice(0, 2)
    .map((segment) => encodeURIComponent(segment))
    .join("/")}/`;

  if (/\.html?$/i.test(objectPath)) {
    const html = rewriteHtml(buffer.toString("utf8"), siteRoot);
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=60",
      },
    });
  }

  if (/\.css$/i.test(objectPath)) {
    const css = rewriteCss(buffer.toString("utf8"), siteRoot);
    return new Response(css, {
      status: 200,
      headers: {
        "content-type": "text/css; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type": mimeFromPath(objectPath),
      "cache-control": "public, max-age=300",
    },
  });
}

type DownloadedObject = { buffer: Buffer; objectPath: string };

async function downloadObject(
  admin: SupabaseClient,
  segments: string[],
): Promise<DownloadedObject | null> {
  const direct = segments.join("/");
  // Se intenta la ruta directa y, como fallback (solo si la directa falla),
  // se resuelve como carpeta sirviendo su index.html.
  const candidates = [direct, `${direct}/index.html`];

  for (const objectPath of candidates) {
    const { data, error } = await admin.storage
      .from(BUCKET_PUBLICO)
      .download(objectPath);

    if (!error && data) {
      const arrayBuffer = await data.arrayBuffer();
      return { buffer: Buffer.from(arrayBuffer), objectPath };
    }
  }

  return null;
}

// Reescribe rutas absolutas (que empiezan en "/") para que apunten a la raíz
// del despliegue dentro del visor. Esto permite renderizar builds nativos
// (Vite, CRA, etc.) que referencian assets como "/assets/app.js".
function rewriteHtml(html: string, siteRoot: string): string {
  const withAbsoluteAttrs = html.replace(
    /(\s(?:src|href|poster)\s*=\s*)(["'])\/(?!\/)/gi,
    (_match, attr: string, quote: string) => `${attr}${quote}${siteRoot}`,
  );
  return rewriteCss(withAbsoluteAttrs, siteRoot);
}

function rewriteCss(css: string, siteRoot: string): string {
  return css.replace(
    /url\(\s*(["']?)\/(?!\/)/gi,
    (_match, quote: string) => `url(${quote}${siteRoot}`,
  );
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
