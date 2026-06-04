-- Migración: proyectos personales por usuario + RLS por propietario.
-- Ejecutar en el SQL Editor de Supabase.

-- 1. Columna de propietario en proyectos.
alter table public.proyectos
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- El propietario se asigna automáticamente al usuario autenticado en el insert.
alter table public.proyectos
  alter column user_id set default auth.uid();

create index if not exists proyectos_user_id_idx
  on public.proyectos (user_id);

-- 2. Reemplazar las políticas permisivas (todos veían todo) por políticas
--    por propietario.
drop policy if exists "Usuarios autenticados gestionan proyectos" on public.proyectos;
drop policy if exists "Usuarios autenticados gestionan versiones" on public.versiones;

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

-- 3. Las versiones heredan la propiedad de su proyecto.
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
