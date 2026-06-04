import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { processZipUpload } from "@/lib/upload/processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          error:
            "La petición debe ser multipart/form-data. No establezcas Content-Type manualmente al enviar FormData.",
        },
        { status: 400 },
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        {
          error:
            "No se pudo leer el archivo enviado. Vuelve a intentarlo o reduce el tamaño del ZIP.",
        },
        { status: 400 },
      );
    }

    const proyectoId = formData.get("proyectoId");
    const versionTag = formData.get("versionTag");
    const file = formData.get("file") ?? formData.get("zip");

    if (
      typeof proyectoId !== "string" ||
      !proyectoId ||
      typeof versionTag !== "string" ||
      !versionTag.trim()
    ) {
      return NextResponse.json(
        { error: "proyectoId y versionTag son obligatorios" },
        { status: 400 },
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Debe enviar un archivo .zip" },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json(
        { error: "Solo se permiten archivos .zip" },
        { status: 400 },
      );
    }

    const tag = versionTag.trim();
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
      .select("id, slug")
      .eq("id", proyectoId)
      .single();

    if (proyectoError || !proyecto) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 },
      );
    }

    const result = await processZipUpload({
      zipBuffer,
      zipFileName: file.name,
      proyectoId,
      versionTag: tag,
      slug: proyecto.slug as string,
      admin,
    });

    return NextResponse.json({
      ok: true,
      version: result.version,
      ruta_visor: result.ruta_visor,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
