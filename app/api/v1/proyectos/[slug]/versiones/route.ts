import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApiUser } from "@/lib/auth/resolveUser";
import { processZipUpload } from "@/lib/upload/processor";
import { toViewerUrl } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await resolveApiUser(request);
    if (!auth) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { slug } = await context.params;

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "La petición debe ser multipart/form-data con el ZIP" },
        { status: 400 },
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "No se pudo leer el archivo enviado." },
        { status: 400 },
      );
    }

    const versionTag = formData.get("versionTag");
    const file = formData.get("zip") ?? formData.get("file");

    if (typeof versionTag !== "string" || !versionTag.trim()) {
      return NextResponse.json(
        { error: "versionTag es obligatorio" },
        { status: 400 },
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Debe enviar un archivo .zip en el campo 'zip'" },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json(
        { error: "Solo se permiten archivos .zip" },
        { status: 400 },
      );
    }

    const zipBuffer = Buffer.from(await file.arrayBuffer());
    if (zipBuffer.length === 0) {
      return NextResponse.json(
        { error: "El archivo ZIP está vacío" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: proyecto, error: proyectoError } = await admin
      .from("proyectos")
      .select("id, slug, user_id")
      .eq("slug", slug)
      .maybeSingle();

    if (proyectoError || !proyecto) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 },
      );
    }

    if (proyecto.user_id !== auth.userId) {
      return NextResponse.json(
        { error: "No puedes subir versiones a un proyecto que no es tuyo" },
        { status: 403 },
      );
    }

    const result = await processZipUpload({
      zipBuffer,
      zipFileName: file.name,
      proyectoId: proyecto.id as string,
      versionTag: versionTag.trim(),
      slug: proyecto.slug as string,
      admin,
    });

    const origin = new URL(request.url).origin;
    const viewerPath = toViewerUrl(result.ruta_visor);

    return NextResponse.json(
      {
        ok: true,
        version: result.version,
        ruta_visor: viewerPath,
        url: `${origin}${viewerPath}`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api/v1/versiones] Error al procesar el ZIP:", error);
    const message =
      error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
