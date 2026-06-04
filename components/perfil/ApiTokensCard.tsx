"use client";

import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type ApiToken = {
  id: string;
  nombre: string;
  token_prefix: string;
  last_used_at: string | null;
  created_at: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "Nunca";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function ApiTokensCard() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/tokens", { credentials: "include" });
      if (!res.ok) throw new Error("No se pudieron cargar los tokens.");
      const data = (await res.json()) as { tokens: ApiToken[] };
      setTokens(data.tokens ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar tokens.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTokens();
  }, [loadTokens]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    setSecret(null);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nombre: nombre.trim() || "Token de Claude" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear el token.");
      setSecret(data.secret as string);
      setNombre("");
      await loadTokens();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear el token.");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar. Cópialo manualmente.");
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/tokens/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("No se pudo revocar el token.");
      setTokens((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al revocar el token.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-[#F0EFFF] px-4 pb-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[2rem] bg-white px-6 py-8 shadow-sm sm:px-10">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F3F4FF] text-[#635BFF]">
              <KeyRound className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-semibold text-[#635BFF]">
              Tokens de acceso (para Claude / CLI)
            </h2>
          </div>
          <p className="mb-6 text-sm text-zinc-500">
            Crea un token para subir prototipos a tus proyectos desde Claude u
            otras herramientas. Se muestra una sola vez.
          </p>

          {/* Crear token */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del token (ej. Claude Design)"
              className="flex-1 rounded-full border-0 bg-[#F3F4F6] px-5 py-3 text-sm text-zinc-800 outline-none ring-[#635BFF] focus:ring-2"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#635BFF] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#5248e6] disabled:opacity-60"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Crear token
            </button>
          </div>

          {/* Secreto recién creado */}
          {secret && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-800">
                Copia tu token ahora. No volverás a verlo.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg bg-white px-3 py-2 font-mono text-xs text-zinc-700">
                  {secret}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-700"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* Lista de tokens */}
          <div className="mt-6 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-zinc-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : tokens.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-400">
                Aún no tienes tokens.
              </p>
            ) : (
              tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#E8E6FF] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-800">
                      {token.nombre}
                    </p>
                    <p className="truncate font-mono text-xs text-zinc-400">
                      {token.token_prefix}••••••  ·  Último uso:{" "}
                      {formatDate(token.last_used_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(token.id)}
                    disabled={deletingId === token.id}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    {deletingId === token.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Revocar
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
