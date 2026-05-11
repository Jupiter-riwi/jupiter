-- ============================================================
-- Jupiter Sales Evaluator — Schema inicial
-- Proyecto Supabase: YOUR_SUPABASE_PROJECT_REF
-- ============================================================

-- ── Extensiones ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Tenants ──────────────────────────────────────────────────
create table public.tenants (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  plan        text        not null default 'starter'
                          check (plan in ('starter', 'pro', 'enterprise')),
  created_at  timestamptz not null default now()
);
comment on table public.tenants is 'Clientes (empresas) que usan la plataforma';

-- ── Profiles (extiende auth.users de Supabase) ───────────────
-- Un registro por cada usuario autenticado.
-- La autenticación real la maneja Supabase Auth (auth.users).
create table public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  tenant_id   uuid        not null references public.tenants(id),
  role        text        not null default 'seller'
                          check (role in ('seller', 'admin')),
  first_name  text,
  last_name   text,
  created_at  timestamptz not null default now()
);
comment on table public.profiles is 'Perfil extendido del usuario, vinculado a un tenant';

-- ── Questions ────────────────────────────────────────────────
create table public.questions (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references public.tenants(id),
  prompt        text        not null,
  category      text,
  target_skill  text,
  created_at    timestamptz not null default now()
);
comment on table public.questions is 'Preguntas de evaluación configuradas por tenant';

-- ── Evaluations ──────────────────────────────────────────────
create type public.evaluation_status as enum (
  'pending',      -- creada, esperando upload
  'processing',   -- workers corriendo
  'completed',    -- score disponible
  'failed'        -- error en algún worker
);

create table public.evaluations (
  id           uuid                      primary key default gen_random_uuid(),
  tenant_id    uuid                      not null references public.tenants(id),
  user_id      uuid                      not null references public.profiles(id),
  question_id  uuid                      references public.questions(id),
  video_url    text,
  status       public.evaluation_status  not null default 'pending',
  created_at   timestamptz               not null default now()
);
comment on table public.evaluations is 'Grabación + estado del proceso de análisis';

-- ── Features (pose / transcript / prosody) ───────────────────
create type public.feature_kind as enum ('pose', 'transcript', 'prosody');

create table public.features (
  id             uuid                  primary key default gen_random_uuid(),
  evaluation_id  uuid                  not null references public.evaluations(id) on delete cascade,
  tenant_id      uuid                  not null,
  kind           public.feature_kind   not null,
  payload        jsonb                 not null default '{}',
  created_at     timestamptz           not null default now()
);
comment on table public.features is 'Features extraídos por cada worker (pose, transcript, prosody)';

-- ── Scores ───────────────────────────────────────────────────
create table public.scores (
  id               uuid        primary key default gen_random_uuid(),
  evaluation_id    uuid        not null references public.evaluations(id) on delete cascade,
  overall          numeric(5,2) not null check (overall between 0 and 100),
  dimensions       jsonb       not null default '{}',
  recommendations  jsonb       not null default '[]',
  created_at       timestamptz not null default now()
);
comment on table public.scores is 'Resultado del scoring por GPT-4o: score, dimensiones y recomendaciones';

-- ── Índices ──────────────────────────────────────────────────
create index on public.profiles (tenant_id);
create index on public.questions (tenant_id);
create index on public.evaluations (tenant_id, user_id);
create index on public.evaluations (status);
create index on public.features (evaluation_id, kind);
create index on public.scores (evaluation_id);

-- ── Row Level Security ───────────────────────────────────────
-- Cada usuario solo ve datos de su propio tenant.

alter table public.tenants       enable row level security;
alter table public.profiles      enable row level security;
alter table public.questions     enable row level security;
alter table public.evaluations   enable row level security;
alter table public.features      enable row level security;
alter table public.scores        enable row level security;

-- Helper: obtiene el tenant_id del usuario autenticado
create or replace function public.my_tenant_id()
returns uuid language sql stable
set search_path = ''
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

-- tenants: cada usuario ve solo su tenant
create policy "tenant: ver el propio"
  on public.tenants for select
  using (id = public.my_tenant_id());

-- profiles: ver y editar solo los de mi tenant
create policy "profiles: ver del tenant"
  on public.profiles for select
  using (tenant_id = public.my_tenant_id());

create policy "profiles: editar el propio"
  on public.profiles for update
  using (id = auth.uid());

-- questions: ver las de mi tenant; admin puede crear/editar
create policy "questions: ver del tenant"
  on public.questions for select
  using (tenant_id = public.my_tenant_id());

create policy "questions: admin puede crear"
  on public.questions for insert
  with check (
    tenant_id = public.my_tenant_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- evaluations: seller ve solo las suyas; admin ve todas del tenant
create policy "evaluations: seller ve las suyas"
  on public.evaluations for select
  using (
    tenant_id = public.my_tenant_id()
    and (
      user_id = auth.uid()
      or exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
      )
    )
  );

create policy "evaluations: seller puede crear la suya"
  on public.evaluations for insert
  with check (
    tenant_id = public.my_tenant_id()
    and user_id = auth.uid()
  );

create policy "evaluations: actualizar estado (workers via service role)"
  on public.evaluations for update
  using (tenant_id = public.my_tenant_id());

-- features y scores: mismo acceso que evaluations
create policy "features: ver del tenant"
  on public.features for select
  using (tenant_id = public.my_tenant_id());

create policy "scores: ver del tenant"
  on public.scores for select
  using (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_id
        and e.tenant_id = public.my_tenant_id()
    )
  );

-- ── Storage bucket para videos ───────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos',
  'videos',
  false,                    -- privado: acceso solo via signed URLs
  524288000,                -- 500 MB máximo por archivo
  array['video/webm', 'video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;

-- Solo el dueño de la evaluación puede subir su video
create policy "videos: upload del dueño"
  on storage.objects for insert
  with check (
    bucket_id = 'videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Solo puede leer quien tenga acceso a la evaluación
create policy "videos: leer del tenant"
  on storage.objects for select
  using (
    bucket_id = 'videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
