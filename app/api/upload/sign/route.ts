import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_PRIVADO } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SignUploadBody = {
  proyectoId?: unknown;
  versionTag?: unknown;
  fileName?: unknown;
  fileSize?: unknown;
};

export async function POST(request: Request) {
  try {
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    let body: SignUploadBody;
    try {
      body = (await request.json()) as SignUploadBody;
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
    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;

    if (!proyectoId || !versionTag) {
      return NextResponse.json(
        { error: "proyectoId y versionTag son obligatorios" },
        { status: 400 },
      );
    }

    if (!fileName.toLowerCase().endsWith(".zip")) {
      return NextResponse.json(
        { error: "Solo se permiten archivos .zip" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json(
        { error: "El archivo ZIP está vacío" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: proyecto, error: proyectoError } = await admin
      .from("proyectos")
      .select("id, user_id")
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

    const objectPath = `_uploads/${user.id}/${randomUUID()}-${sanitizeFileName(
      fileName,
    )}`;
    const { data, error } = await admin.storage
      .from(BUCKET_PRIVADO)
      .createSignedUploadUrl(objectPath);

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "No se pudo preparar la subida del ZIP" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
