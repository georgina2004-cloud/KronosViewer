import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { processZipUpload } from "@/lib/upload/processor";
import { BUCKET_PRIVADO } from "@/lib/utils";

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
    if (contentType.includes("application/json")) {
      return await processUploadedZipFromStorage(request, user.id);
    }

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          error:
            "La petición debe ser multipart/form-data o application/json.",
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
      .select("id, slug, user_id")
      .eq("id", proyectoId)
      .single();

    if (proyectoError || !proyecto) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 },
      );
    }

    if (proyecto.user_id !== user.id) {
      return NextResponse.json(
        { error: "No puedes subir versiones a un proyecto que no es tuyo" },
        { status: 403 },
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
    console.error("[api/upload] Error al procesar el ZIP:", error);
    const message =
      error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type ProcessStorageUploadBody = {
  proyectoId?: unknown;
  versionTag?: unknown;
  zipStoragePath?: unknown;
  zipFileName?: unknown;
};

async function processUploadedZipFromStorage(
  request: Request,
  userId: string,
) {
  let body: ProcessStorageUploadBody;
  try {
    body = (await request.json()) as ProcessStorageUploadBody;
  } catch {
    return NextResponse.json(
      { error: "La petición debe ser JSON válido" },
      { status: 400 },
    );
  }

  const proyectoId =
    typeof body.proyectoId === "string" ? body.proyectoId : "";
  const versionTag =
    typeof body.versionTag === "string" ? body.versionTag.trim() : "";
  const zipStoragePath =
    typeof body.zipStoragePath === "string" ? body.zipStoragePath : "";
  const zipFileName =
    typeof body.zipFileName === "string" ? body.zipFileName : "proyecto.zip";

  if (!proyectoId || !versionTag || !zipStoragePath) {
    return NextResponse.json(
      { error: "proyectoId, versionTag y zipStoragePath son obligatorios" },
      { status: 400 },
    );
  }

  if (!zipStoragePath.startsWith(`_uploads/${userId}/`)) {
    return NextResponse.json(
      { error: "Ruta de ZIP no autorizada" },
      { status: 403 },
    );
  }

  if (!zipFileName.toLowerCase().endsWith(".zip")) {
    return NextResponse.json(
      { error: "Solo se permiten archivos .zip" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: zipBlob, error: zipDownloadError } = await admin.storage
    .from(BUCKET_PRIVADO)
    .download(zipStoragePath);

  if (zipDownloadError || !zipBlob) {
    return NextResponse.json(
      {
        error:
          zipDownloadError?.message ??
          "No se pudo leer el ZIP subido a Storage",
      },
      { status: 400 },
    );
  }

  const zipBuffer = Buffer.from(await zipBlob.arrayBuffer());
  if (zipBuffer.length === 0) {
    return NextResponse.json(
      { error: "El archivo ZIP está vacío" },
      { status: 400 },
    );
  }

  const { data: proyecto, error: proyectoError } = await admin
    .from("proyectos")
    .select("id, slug, user_id")
    .eq("id", proyectoId)
    .single();

  if (proyectoError || !proyecto) {
    return NextResponse.json(
      { error: "Proyecto no encontrado" },
      { status: 404 },
    );
  }

  if (proyecto.user_id !== userId) {
    return NextResponse.json(
      { error: "No puedes subir versiones a un proyecto que no es tuyo" },
      { status: 403 },
    );
  }

  const result = await processZipUpload({
    zipBuffer,
    zipFileName,
    existingZipStoragePath: zipStoragePath,
    proyectoId,
    versionTag,
    slug: proyecto.slug as string,
    admin,
  });

  return NextResponse.json({
    ok: true,
    version: result.version,
    ruta_visor: result.ruta_visor,
  });
}
