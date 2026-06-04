-- Ejecutar en el SQL Editor de Supabase antes de usar la app.

create table if not exists public.proyectos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  descripcion text,
  fecha_creacion timestamptz not null default now()
);

create table if not exists public.versiones (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos (id) on delete cascade,
  version_tag text not null,
  ruta_visor text not null,
  ruta_zip_storage text not null,
  fecha_subida timestamptz not null default now(),
  unique (proyecto_id, version_tag)
);

alter table public.proyectos enable row level security;
alter table public.versiones enable row level security;

create policy "Usuarios autenticados gestionan proyectos"
  on public.proyectos
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Usuarios autenticados gestionan versiones"
  on public.versiones
  for all
  to authenticated
  using (true)
  with check (true);

-- Migración desde columnas antiguas (opcional):
-- alter table public.proyectos rename column created_at to fecha_creacion;
-- alter table public.versiones rename column zip_path to ruta_zip_storage;
-- alter table public.versiones rename column created_at to fecha_subida;

-- Buckets (Storage):
-- 1. sitios-desplegados (público)
-- 2. respaldos-zips (privado)
