-- Ejecutar en el SQL Editor de Supabase antes de usar la app.

create table if not exists public.proyectos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade default auth.uid(),
  nombre text not null,
  slug text not null unique,
  descripcion text,
  fecha_creacion timestamptz not null default now()
);

-- Garantiza la columna user_id aunque la tabla ya existiera de una versión
-- anterior (create table if not exists no añade columnas nuevas).
alter table public.proyectos
  add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.proyectos
  alter column user_id set default auth.uid();

create index if not exists proyectos_user_id_idx on public.proyectos (user_id);

create table if not exists public.versiones (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos (id) on delete cascade,
  version_tag text not null,
  ruta_visor text not null,
  ruta_zip_storage text not null,
  fecha_subida timestamptz not null default now(),
  unique (proyecto_id, version_tag)
);

-- Tokens de acceso personal (PAT) para clientes externos (skill/MCP/CLI).
create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  nombre text not null,
  token_hash text not null unique,
  token_prefix text not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists api_tokens_user_id_idx on public.api_tokens (user_id);
create index if not exists api_tokens_token_hash_idx on public.api_tokens (token_hash);

alter table public.proyectos enable row level security;
alter table public.versiones enable row level security;
alter table public.api_tokens enable row level security;

-- Limpia políticas previas (permisivas o re-ejecuciones) para que el script
-- sea idempotente.
drop policy if exists "Usuarios autenticados gestionan proyectos" on public.proyectos;
drop policy if exists "Usuarios autenticados gestionan versiones" on public.versiones;
drop policy if exists "Propietario lee sus proyectos" on public.proyectos;
drop policy if exists "Propietario crea sus proyectos" on public.proyectos;
drop policy if exists "Propietario actualiza sus proyectos" on public.proyectos;
drop policy if exists "Propietario elimina sus proyectos" on public.proyectos;
drop policy if exists "Propietario gestiona versiones de sus proyectos" on public.versiones;
drop policy if exists "Propietario lee sus tokens" on public.api_tokens;
drop policy if exists "Propietario crea sus tokens" on public.api_tokens;
drop policy if exists "Propietario elimina sus tokens" on public.api_tokens;

-- Proyectos: cada usuario solo ve y gestiona los suyos.
create policy "Propietario lee sus proyectos"
  on public.proyectos
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Propietario crea sus proyectos"
  on public.proyectos
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Propietario actualiza sus proyectos"
  on public.proyectos
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Propietario elimina sus proyectos"
  on public.proyectos
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Versiones: heredan la propiedad del proyecto.
create policy "Propietario gestiona versiones de sus proyectos"
  on public.versiones
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.proyectos p
      where p.id = versiones.proyecto_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.proyectos p
      where p.id = versiones.proyecto_id
        and p.user_id = auth.uid()
    )
  );

-- Tokens de API: cada usuario gestiona los suyos.
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

-- Migración desde columnas antiguas (opcional):
-- alter table public.proyectos rename column created_at to fecha_creacion;
-- alter table public.versiones rename column zip_path to ruta_zip_storage;
-- alter table public.versiones rename column created_at to fecha_subida;

-- Buckets (Storage):
-- 1. sitios-desplegados (público)
-- 2. respaldos-zips (privado)
