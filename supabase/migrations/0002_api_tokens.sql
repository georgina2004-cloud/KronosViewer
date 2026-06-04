-- Migración: tokens de acceso personal (PAT) para clientes externos
-- (skill de Claude, MCP, CLI, etc.). Ejecutar en el SQL Editor de Supabase.

create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  nombre text not null,
  -- Solo se guarda el hash SHA-256 del token; el valor en claro se muestra
  -- una única vez al crearlo.
  token_hash text not null unique,
  token_prefix text not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists api_tokens_user_id_idx on public.api_tokens (user_id);
create index if not exists api_tokens_token_hash_idx on public.api_tokens (token_hash);

alter table public.api_tokens enable row level security;

drop policy if exists "Propietario lee sus tokens" on public.api_tokens;
drop policy if exists "Propietario crea sus tokens" on public.api_tokens;
drop policy if exists "Propietario elimina sus tokens" on public.api_tokens;

create policy "Propietario lee sus tokens"
  on public.api_tokens
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Propietario crea sus tokens"
  on public.api_tokens
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Propietario elimina sus tokens"
  on public.api_tokens
  for delete
  to authenticated
  using (user_id = auth.uid());
