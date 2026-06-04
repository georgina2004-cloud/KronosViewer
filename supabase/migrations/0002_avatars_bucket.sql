-- Bucket público para fotos de perfil (ejecutar en SQL Editor de Supabase).

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Avatar público lectura" on storage.objects;
drop policy if exists "Usuario sube su avatar" on storage.objects;
drop policy if exists "Usuario actualiza su avatar" on storage.objects;
drop policy if exists "Usuario elimina su avatar" on storage.objects;

create policy "Avatar público lectura"
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');

create policy "Usuario sube su avatar"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Usuario actualiza su avatar"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Usuario elimina su avatar"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
