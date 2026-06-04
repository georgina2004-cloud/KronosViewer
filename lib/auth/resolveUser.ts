import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { bearerFromRequest, hashApiToken } from "@/lib/auth/apiToken";

export type ResolvedUser = {
  userId: string;
  via: "token" | "session";
};

// Resuelve el usuario autenticado aceptando dos mecanismos:
//   1. Authorization: Bearer <token> (clientes externos: skill, MCP, CLI).
//   2. Cookie de sesión de Supabase (navegador).
export async function resolveApiUser(
  request: Request,
): Promise<ResolvedUser | null> {
  const token = bearerFromRequest(request);

  if (token) {
    const admin = createAdminClient();
    const tokenHash = hashApiToken(token);

    const { data, error } = await admin
      .from("api_tokens")
      .select("id, user_id")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error || !data) return null;

    // Marca de último uso (best-effort, no bloquea la respuesta).
    void admin
      .from("api_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);

    return { userId: data.user_id as string, via: "token" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return { userId: user.id, via: "session" };
}
