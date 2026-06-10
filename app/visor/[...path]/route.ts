import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_PUBLICO, mimeFromPath } from "@/lib/utils";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path?: string[] }> };

export async function GET(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const segments = (path ?? []).map((segment) => safeDecode(segment));

  if (segments.length === 0) {
    return new Response("Ruta inválida", { status: 400 });
  }

  if (segments.some((segment) => segment === "..")) {
    return new Response("Ruta inválida", { status: 400 });
  }

  if (
    segments.length === 3 &&
    segments[2].toLowerCase() === "index.html"
  ) {
    const url = new URL(request.url);
    url.pathname = `/visor/${segments
      .slice(0, 2)
      .map((segment) => encodeURIComponent(segment))
      .join("/")}`;
    return Response.redirect(url, 308);
  }

  const admin = createAdminClient();
  const optimizedImage = await downloadNextImageObject(admin, request, segments);
  if (optimizedImage) {
    return fileResponse(optimizedImage.buffer, optimizedImage.objectPath);
  }

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

  if (/\.m?js$/i.test(objectPath)) {
    const javascript = rewriteJavascript(buffer.toString("utf8"), siteRoot);
    return new Response(javascript, {
      status: 200,
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }

  return fileResponse(buffer, objectPath);
}

function fileResponse(buffer: Buffer, objectPath: string): Response {
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

async function downloadNextImageObject(
  admin: SupabaseClient,
  request: Request,
  segments: string[],
): Promise<DownloadedObject | null> {
  if (segments.length < 4) return null;
  if (segments[2] !== "_next" || segments[3] !== "image") return null;

  const imageUrl = new URL(request.url).searchParams.get("url");
  if (!imageUrl) return null;

  const decoded = safeDecode(imageUrl).replace(/^\/+/, "");
  if (!decoded || decoded.split("/").some((segment) => segment === "..")) {
    return null;
  }

  const objectPath = [...segments.slice(0, 2), decoded].join("/");
  const { data, error } = await admin.storage
    .from(BUCKET_PUBLICO)
    .download(objectPath);

  if (error || !data) return null;

  const arrayBuffer = await data.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), objectPath };
}

// Reescribe rutas absolutas (que empiezan en "/") para que apunten a la raíz
// del despliegue dentro del visor. Esto permite renderizar builds nativos
// (Vite, CRA, etc.) que referencian assets como "/assets/app.js".
function rewriteHtml(html: string, siteRoot: string): string {
  const withAbsoluteAttrs = html.replace(
    /(\s(?:src|srcset|href|poster)\s*=\s*)(["'])\/(?!\/)/gi,
    (_match, attr: string, quote: string) => `${attr}${quote}${siteRoot}`,
  );
  const withRelativeAttrs = rewriteRelativeAttrs(
    rewriteAbsoluteQuotedPaths(
      rewriteNextInternals(withAbsoluteAttrs, siteRoot),
      siteRoot,
    ),
    siteRoot,
  );
  return rewriteCss(withRelativeAttrs, siteRoot);
}

// Sitios estáticos suelen referenciar assets con rutas relativas
// (href="styles.css", src="assets/foto.jpg"). El visor sirve el HTML en
// /visor/<slug>/<version> (sin barra final), así que el navegador resolvería
// esas rutas contra /visor/<slug>/ y perdería el segmento de versión. Aquí se
// anclan a la raíz real del despliegue. Se excluyen anclas (#), protocolos
// (http, mailto, tel, data...) y rutas ya absolutas (/), por lo que no afecta a
// builds de frameworks (que usan rutas absolutas) ni a la navegación interna.
function rewriteRelativeAttrs(html: string, siteRoot: string): string {
  return html.replace(
    /(\s(?:src|href|poster)\s*=\s*)(["'])(?!https?:|\/\/|\/|#|\?|data:|blob:|mailto:|tel:|javascript:)([^"']+)\2/gi,
    (_match, attr: string, quote: string, value: string) =>
      `${attr}${quote}${siteRoot}${value}${quote}`,
  );
}

function rewriteCss(css: string, siteRoot: string): string {
  return css
    .replace(
      /url\(\s*(["']?)\/(?!\/)/gi,
      (_match, quote: string) => `url(${quote}${siteRoot}`,
    )
    .replace(/url\(&quot;\/(?!\/)/gi, `url(&quot;${siteRoot}`);
}

function rewriteJavascript(javascript: string, siteRoot: string): string {
  return rewriteRouterBasename(
    rewriteAbsoluteAssetPaths(
      rewriteNextInternals(javascript, siteRoot),
      siteRoot,
    ),
    siteRoot,
  );
}

function rewriteNextInternals(content: string, siteRoot: string): string {
  const nextRoot = `${siteRoot}_next/`;
  return content
    .replaceAll('"/_next/', `"${nextRoot}`)
    .replaceAll("'/_next/", `'${nextRoot}`)
    .replaceAll(", /_next/", `, ${nextRoot}`)
    .replaceAll('\\"/_next/', `\\"${nextRoot}`)
    .replaceAll("\\'/_next/", `\\'${nextRoot}`)
    .replaceAll('d.p="/_next/"', `d.p="${nextRoot}"`);
}

function rewriteAbsoluteQuotedPaths(content: string, siteRoot: string): string {
  return content
    .replace(
      /(["'])\/(?!\/|visor\/|_next\/)/g,
      (_match, quote: string) => `${quote}${siteRoot}`,
    )
    .replace(
      /(\\["'])\/(?!\/|visor\/|_next\/)/g,
      (_match, quote: string) => `${quote}${siteRoot}`,
    );
}

function rewriteAbsoluteAssetPaths(content: string, siteRoot: string): string {
  return content.replace(
    /(["'`])\/(?!\/|visor\/|_next\/)([^"'`\s?#]+\.[a-zA-Z0-9]{2,8})([?#][^"'`]*)?\1/g,
    (
      _match,
      quote: string,
      assetPath: string,
      suffix: string | undefined,
    ) => `${quote}${siteRoot}${assetPath}${suffix ?? ""}${quote}`,
  );
}

function rewriteRouterBasename(content: string, siteRoot: string): string {
  const basename = siteRoot.replace(/\/$/, "");
  return content.replace(
    /basename\s*:\s*(["'`])\/\1/g,
    (_match, quote: string) => `basename:${quote}${basename}${quote}`,
  );
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
