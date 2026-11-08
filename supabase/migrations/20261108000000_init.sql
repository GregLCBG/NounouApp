-- Schéma initial NounouApp.

-- Qui a accès à l'app : seules les personnes listées ici (créées à la main).
create table public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('parent', 'nounou')),
  prenom text not null
);

-- Versions du contrat (chaque avenant = une nouvelle ligne avec sa date d'effet).
create table public.contrats (
  id bigint generated always as identity primary key,
  date_effet date not null unique,
  taux_horaire_brut_centimes integer not null check (taux_horaire_brut_centimes > 0),
  taux_horaire_net_centimes integer not null check (taux_horaire_net_centimes > 0),
  semaines_payees_par_an integer not null default 52,
  -- {"1":[{"debut":"16:30","fin":"18:30"}], "3":[...]} — 1 = lundi … 7 = dimanche
  planning_hebdo jsonb not null,
  created_at timestamptz not null default now()
);

-- Motif d'un écart entre l'agenda et le contrat, pour un jour donné.
create table public.motifs_jour (
  jour date primary key,
  motif text not null check (motif in ('absence_parents', 'jour_ferie_chome', 'conge_paye', 'maladie', 'absence_non_remuneree')),
  commentaire text,
  saisi_par uuid not null references public.profils (id),
  saisi_le timestamptz not null default now()
);

-- Validation hebdomadaire par la salariée (la semaine est figée ensuite).
create table public.validations_semaine (
  lundi date primary key check (extract(isodow from lundi) = 1),
  minutes_par_jour jsonb not null, -- photo de l'agenda au moment de la validation
  validee_par uuid not null references public.profils (id),
  validee_le timestamptz not null default now()
);

-- Clôture mensuelle par un parent, puis suivi de la déclaration Pajemploi.
create table public.clotures_mois (
  mois date primary key check (extract(day from mois) = 1),
  recap jsonb not null,
  cloture_par uuid not null references public.profils (id),
  cloture_le timestamptz not null default now(),
  declaration_statut text not null default 'a_declarer'
    check (declaration_statut in ('a_declarer', 'en_cours', 'declaree', 'echec')),
  declaration_detail jsonb
);

create index on public.motifs_jour (saisi_par);
create index on public.validations_semaine (validee_par);
create index on public.clotures_mois (cloture_par);

-- ---------------------------------------------------------------------------
-- Sécurité (Row Level Security) : rien n'est lisible sans profil.
-- Les fonctions d'aide sont SECURITY DEFINER (pour lire profils sans récursion RLS),
-- donc rangées dans un schéma non exposé par l'API et réservées aux connectés.
-- ---------------------------------------------------------------------------
create schema prive;
revoke all on schema prive from public;
grant usage on schema prive to authenticated;

create function prive.mon_role() returns text
language sql stable security definer set search_path = ''
as $$ select role from public.profils where id = (select auth.uid()) $$;

create function prive.mois_cloture(j date) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.clotures_mois where mois = date_trunc('month', j)::date) $$;

create function prive.semaine_validee(j date) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.validations_semaine where lundi = date_trunc('week', j)::date) $$;

revoke execute on all functions in schema prive from public, anon;
grant execute on all functions in schema prive to authenticated;

alter table public.profils enable row level security;
alter table public.contrats enable row level security;
alter table public.motifs_jour enable row level security;
alter table public.validations_semaine enable row level security;
alter table public.clotures_mois enable row level security;

-- Accès API : connectés uniquement (jamais anon), filtré ensuite par les politiques.
revoke all on public.profils, public.contrats, public.motifs_jour, public.validations_semaine, public.clotures_mois from anon;
grant select on public.profils, public.validations_semaine, public.clotures_mois to authenticated;
grant select, insert, update, delete on public.contrats, public.motifs_jour to authenticated;
grant insert on public.validations_semaine, public.clotures_mois to authenticated;

create policy "lecture membres" on public.profils for select to authenticated using ((select prive.mon_role()) is not null);
create policy "lecture membres" on public.contrats for select to authenticated using ((select prive.mon_role()) is not null);
create policy "lecture membres" on public.motifs_jour for select to authenticated using ((select prive.mon_role()) is not null);
create policy "lecture membres" on public.validations_semaine for select to authenticated using ((select prive.mon_role()) is not null);
create policy "lecture membres" on public.clotures_mois for select to authenticated using ((select prive.mon_role()) is not null);

-- Contrat : parents uniquement.
create policy "parents ajoutent" on public.contrats for insert to authenticated
  with check ((select prive.mon_role()) = 'parent');
create policy "parents modifient" on public.contrats for update to authenticated
  using ((select prive.mon_role()) = 'parent') with check ((select prive.mon_role()) = 'parent');
create policy "parents suppriment" on public.contrats for delete to authenticated
  using ((select prive.mon_role()) = 'parent');

-- Motifs : tout membre tant que la semaine n'est pas validée ; ensuite parents seulement ;
-- plus personne une fois le mois clôturé.
create policy "saisie motifs" on public.motifs_jour for insert to authenticated
  with check (
    saisi_par = (select auth.uid())
    and not prive.mois_cloture(jour)
    and ((select prive.mon_role()) = 'parent' or ((select prive.mon_role()) = 'nounou' and not prive.semaine_validee(jour)))
  );
create policy "modif motifs" on public.motifs_jour for update to authenticated
  using (
    not prive.mois_cloture(jour)
    and ((select prive.mon_role()) = 'parent' or ((select prive.mon_role()) = 'nounou' and not prive.semaine_validee(jour)))
  )
  with check (
    saisi_par = (select auth.uid())
    and not prive.mois_cloture(jour)
    and ((select prive.mon_role()) = 'parent' or ((select prive.mon_role()) = 'nounou' and not prive.semaine_validee(jour)))
  );
create policy "suppression motifs" on public.motifs_jour for delete to authenticated
  using (
    not prive.mois_cloture(jour)
    and ((select prive.mon_role()) = 'parent' or ((select prive.mon_role()) = 'nounou' and not prive.semaine_validee(jour)))
  );

-- Validation de semaine : tout membre, une seule fois (pas d'update/delete).
create policy "valider semaine" on public.validations_semaine for insert to authenticated
  with check (validee_par = (select auth.uid()) and (select prive.mon_role()) is not null and not prive.mois_cloture(lundi));

-- Clôture : parents uniquement. Le statut de déclaration est mis à jour par le robot (clé service).
create policy "parents clôturent" on public.clotures_mois for insert to authenticated
  with check (cloture_par = (select auth.uid()) and (select prive.mon_role()) = 'parent');
