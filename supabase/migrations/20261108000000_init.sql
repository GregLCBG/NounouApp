-- Schéma initial NounouApp.
-- À exécuter dans Supabase : SQL Editor → coller ce fichier → Run.

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

-- ---------------------------------------------------------------------------
-- Sécurité (Row Level Security) : rien n'est lisible sans profil.
-- ---------------------------------------------------------------------------
create function public.mon_role() returns text
language sql stable security definer set search_path = public
as $$ select role from public.profils where id = auth.uid() $$;

create function public.mois_cloture(j date) returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.clotures_mois where mois = date_trunc('month', j)::date) $$;

create function public.semaine_validee(j date) returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.validations_semaine where lundi = date_trunc('week', j)::date) $$;

alter table public.profils enable row level security;
alter table public.contrats enable row level security;
alter table public.motifs_jour enable row level security;
alter table public.validations_semaine enable row level security;
alter table public.clotures_mois enable row level security;

create policy "lecture membres" on public.profils for select using (public.mon_role() is not null);
create policy "lecture membres" on public.contrats for select using (public.mon_role() is not null);
create policy "lecture membres" on public.motifs_jour for select using (public.mon_role() is not null);
create policy "lecture membres" on public.validations_semaine for select using (public.mon_role() is not null);
create policy "lecture membres" on public.clotures_mois for select using (public.mon_role() is not null);

-- Contrat : parents uniquement.
create policy "parents écrivent" on public.contrats for all
  using (public.mon_role() = 'parent') with check (public.mon_role() = 'parent');

-- Motifs : tout membre tant que la semaine n'est pas validée ; ensuite parents seulement ;
-- plus personne une fois le mois clôturé.
create policy "saisie motifs" on public.motifs_jour for all
  using (
    not public.mois_cloture(jour)
    and (public.mon_role() = 'parent' or (public.mon_role() = 'nounou' and not public.semaine_validee(jour)))
  )
  with check (
    saisi_par = auth.uid()
    and not public.mois_cloture(jour)
    and (public.mon_role() = 'parent' or (public.mon_role() = 'nounou' and not public.semaine_validee(jour)))
  );

-- Validation de semaine : tout membre, une seule fois (pas d'update/delete).
create policy "valider semaine" on public.validations_semaine for insert
  with check (validee_par = auth.uid() and public.mon_role() is not null and not public.mois_cloture(lundi));

-- Clôture : parents uniquement. Le statut de déclaration est mis à jour par le robot (clé service).
create policy "parents clôturent" on public.clotures_mois for insert
  with check (cloture_par = auth.uid() and public.mon_role() = 'parent');
