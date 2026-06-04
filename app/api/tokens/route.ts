import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateApiToken } from "@/lib/auth/apiToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getSessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_tokens")
    .select("id, nombre, token_prefix, last_used_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tokens: data ?? [] });
}

type CreateTokenBody = { nombre?: unknown };

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: CreateTokenBody;
  try {
    body = (await request.json()) as CreateTokenBody;
  } catch {
    body = {};
  }

  const nombre =
    typeof body.nombre === "string" && body.nombre.trim()
      ? body.nombre.trim().slice(0, 80)
      : "Token sin nombre";

  const { raw, hash, prefix } = generateApiToken();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("api_tokens")
    .insert({
      user_id: userId,
      nombre,
      token_hash: hash,
      token_prefix: prefix,
    })
    .select("id, nombre, token_prefix, last_used_at, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // El token en claro solo se devuelve aquí, una vez.
  return NextResponse.json({ token: data, secret: raw }, { status: 201 });
}
