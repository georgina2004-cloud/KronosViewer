import { createHash, randomBytes } from "crypto";

export const API_TOKEN_PREFIX = "kv_";

export type GeneratedToken = {
  raw: string;
  hash: string;
  prefix: string;
};

// Genera un token de acceso personal. El valor en claro (`raw`) solo se devuelve
// aquí; en la base de datos únicamente se guarda su hash.
export function generateApiToken(): GeneratedToken {
  const raw = `${API_TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
  return {
    raw,
    hash: hashApiToken(raw),
    prefix: raw.slice(0, API_TOKEN_PREFIX.length + 6),
  };
}

export function hashApiToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// Extrae el token Bearer del header Authorization, si existe.
export function bearerFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}
