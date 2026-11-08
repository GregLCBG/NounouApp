-- Documents : contrats, bulletins de paie, autres pièces.
-- Parents : voient et gèrent tout. Nounou : voit uniquement ses propres documents.
-- salarie_id null = document de la famille (ex. ancien contrat de prestation), visible des parents seulement.

create table public.documents (
  id bigint generated always as identity primary key,
  salarie_id uuid references public.profils (id) on delete restrict,
  type text not null check (type in ('contrat', 'bulletin', 'autre')),
  mois date check (mois is null or extract(day from mois) = 1),
  titre text not null check (length(titre) between 1 and 200),
  -- chemin dans le bucket : '<salarie_id ou "famille">/<uuid>.<ext>'
  chemin text not null unique,
  ajoute_par uuid not null references public.profils (id),
  created_at timestamptz not null default now(),
  check (type <> 'bulletin' or mois is not null)
);

create index on public.documents (salarie_id);
create index on public.documents (ajoute_par);

alter table public.documents enable row level security;
revoke all on public.documents from anon;
grant select, insert, delete on public.documents to authenticated;

create policy "lecture documents" on public.documents for select to authenticated
  using (
    (select prive.mon_role()) = 'parent'
    or ((select prive.mon_role()) = 'nounou' and salarie_id = (select auth.uid()))
  );
create policy "parents ajoutent" on public.documents for insert to authenticated
  with check ((select prive.mon_role()) = 'parent' and ajoute_par = (select auth.uid()));
create policy "parents suppriment" on public.documents for delete to authenticated
  using ((select prive.mon_role()) = 'parent');

-- Bucket privé (10 Mo max, PDF et photos).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png']);

create policy "documents : lecture" on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      (select prive.mon_role()) = 'parent'
      or ((select prive.mon_role()) = 'nounou' and (storage.foldername(name))[1] = (select auth.uid())::text)
    )
  );
create policy "documents : ajout par les parents" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (select prive.mon_role()) = 'parent');
create policy "documents : suppression par les parents" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (select prive.mon_role()) = 'parent');
