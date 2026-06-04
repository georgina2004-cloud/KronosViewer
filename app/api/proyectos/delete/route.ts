import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_PRIVADO, BUCKET_PUBLICO } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeleteBody = { proyectoId?: unknown };

export async function POST(request: Request) {
  try {
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    let body: DeleteBody;
    try {
      body = (await request.json()) as DeleteBody;
    } catch {
      return NextResponse.json(
        { error: "La petición debe ser JSON válido" },
        { status: 400 },
      );
    }

    const proyectoId =
      typeof body.proyectoId === "string" ? body.proyectoId : "";

    if (!proyectoId) {
      return NextResponse.json(
        { error: "proyectoId es obligatorio" },
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
        { error: "No puedes eliminar un proyecto que no es tuyo" },
        { status: 403 },
      );
    }

    // 1. Eliminar los respaldos ZIP referenciados por las versiones.
    const { data: versiones } = await admin
      .from("versiones")
      .select("ruta_zip_storage")
      .eq("proyecto_id", proyectoId);

    const zipPaths = (versiones ?? [])
      .map((v) => (typeof v.ruta_zip_storage === "string" ? v.ruta_zip_storage : ""))
      .filter(Boolean);

    if (zipPaths.length > 0) {
      await admin.storage.from(BUCKET_PRIVADO).remove(zipPaths);
    }

    // 2. Limpiar los archivos desplegados y respaldos por prefijo de slug.
    const slug = proyecto.slug as string;
    await removeStoragePrefix(admin, BUCKET_PUBLICO, slug);
    await removeStoragePrefix(admin, BUCKET_PRIVADO, slug);

    // 3. Borrar el proyecto (las versiones caen por ON DELETE CASCADE).
    const { error: deleteError } = await admin
      .from("proyectos")
      .delete()
      .eq("id", proyectoId);

    if (deleteError) {
      return NextResponse.json(
        { error: `No se pudo eliminar el proyecto: ${deleteError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Lista recursivamente todos los objetos bajo un prefijo y los elimina.
async function removeStoragePrefix(
  admin: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<void> {
  const paths = await listAllObjects(admin, bucket, prefix);
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    if (batch.length > 0) {
      await admin.storage.from(bucket).remove(batch);
    }
  }
}

async function listAllObjects(
  admin: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const results: string[] = [];

  const { data, error } = await admin.storage.from(bucket).list(prefix, {
    limit: 1000,
  });

  if (error || !data) return results;

  for (const entry of data) {
    // Los archivos tienen metadata/id; las "carpetas" no.
    const childPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id) {
      results.push(childPath);
    } else {
      const nested = await listAllObjects(admin, bucket, childPath);
      results.push(...nested);
    }
  }

  return results;
}
