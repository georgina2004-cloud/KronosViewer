import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApiUser } from "@/lib/auth/resolveUser";
import { slugifyNombre } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await resolveApiUser(request);
  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("proyectos")
    .select("id, nombre, slug, descripcion, fecha_creacion")
    .eq("user_id", auth.userId)
    .order("fecha_creacion", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ proyectos: data ?? [] });
}

type CreateBody = { nombre?: unknown; descripcion?: unknown };

export async function POST(request: Request) {
  const auth = await resolveApiUser(request);
  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json(
      { error: "La petición debe ser JSON válido" },
      { status: 400 },
    );
  }

  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const descripcion =
    typeof body.descripcion === "string" ? body.descripcion.trim() : "";

  if (!nombre) {
    return NextResponse.json(
      { error: "El nombre del proyecto es obligatorio" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  try {
    const proyecto = await createProyecto(admin, auth.userId, nombre, descripcion);
    return NextResponse.json({ proyecto }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear el proyecto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Inserta el proyecto generando un slug único de forma global (el slug se usa
// como ruta en Storage); ante colisión reintenta con un sufijo corto.
async function createProyecto(
  admin: SupabaseClient,
  userId: string,
  nombre: string,
  descripcion: string,
) {
  const baseSlug = slugifyNombre(nombre) || "proyecto";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug =
      attempt === 0
        ? baseSlug
        : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    const { data, error } = await admin
      .from("proyectos")
      .insert({
        user_id: userId,
        nombre,
        slug,
        descripcion: descripcion || null,
      })
      .select("id, nombre, slug, descripcion, fecha_creacion")
      .single();

    if (!error && data) return data;
    if (error && error.code !== "23505") throw new Error(error.message);
  }

  throw new Error(
    "No se pudo generar un identificador único para el proyecto. Inténtalo de nuevo.",
  );
}
