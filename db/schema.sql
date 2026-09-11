-- Videoteca IG — schema principal (Postgres / Vercel Neon)
-- Rode este arquivo com: npm run db:migrate
-- (ou cole no SQL editor do Neon / psql)

create extension if not exists "pgcrypto";

-- ============================================================
-- VIDEOS: espelha os vídeos/reels vindos do Instagram (via Meta
-- Graph API) ou cadastrados manualmente.
-- ============================================================
create table if not exists videos (
  id                uuid primary key default gen_random_uuid(),
  ig_media_id       text unique,               -- id do media na Graph API (null se manual)
  source            text not null default 'manual' check (source in ('meta', 'manual', 'claude_code')),
  caption           text,
  media_type        text check (media_type in ('REELS', 'VIDEO', 'CAROUSEL_ALBUM', 'IMAGE', 'OTHER')),
  thumbnail_url     text,
  video_url         text,
  blob_url          text,                      -- cópia própria no Vercel Blob, se houver
  permalink         text,
  posted_at         timestamptz,
  views             bigint default 0,
  likes             bigint default 0,
  comments          bigint default 0,
  shares            bigint default 0,
  saves             bigint default 0,
  reach             bigint default 0,
  raw_meta          jsonb,                     -- payload bruto da Graph API para auditoria
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_videos_posted_at on videos (posted_at desc);

-- ============================================================
-- SCRIPTS (roteiros): roteiro completo + gancho (3s iniciais) +
-- estrutura. Pode estar ligado a um vídeo publicado ou ser um
-- roteiro novo ainda não gravado.
-- ============================================================
create table if not exists scripts (
  id                uuid primary key default gen_random_uuid(),
  video_id          uuid references videos(id) on delete set null,
  title             text not null default 'Roteiro sem título',
  full_script        text not null default '',   -- card grande esquerda
  hook              text not null default '',    -- gancho, primeiros 3s
  structure         text not null default '',    -- estrutura do roteiro
  status            text not null default 'draft' check (status in ('draft', 'ready', 'published', 'archived')),
  source            text not null default 'manual' check (source in ('manual', 'claude_code')),
  created_by        text,                         -- 'pedro' | 'claude_code:<cliente>' etc
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_scripts_video_id on scripts (video_id);

-- ============================================================
-- ANALYSES: resumo/análise que o Gemini gera para um vídeo
-- (e opcionalmente ligado a um roteiro). Guarda status para a
-- barra de progresso do front e para o Claude Code do cliente
-- consultar.
-- ============================================================
create table if not exists analyses (
  id                uuid primary key default gen_random_uuid(),
  video_id          uuid not null references videos(id) on delete cascade,
  script_id         uuid references scripts(id) on delete set null,
  status            text not null default 'pending' check (status in ('pending', 'processing', 'done', 'error')),
  summary           text,                        -- resumo final do Gemini
  patterns          text,                        -- padrões/roteiro identificado
  raw_response      jsonb,                       -- resposta bruta do Gemini
  error_message     text,
  requested_by      text,                        -- 'pedro' | 'claude_code:<cliente>'
  requested_at      timestamptz not null default now(),
  completed_at      timestamptz
);

create index if not exists idx_analyses_video_id on analyses (video_id, requested_at desc);

-- ============================================================
-- META_INSIGHTS: snapshots de métricas da conta do Instagram via
-- Facebook Graph API (seguidores, alcance, impressões, etc).
-- ============================================================
create table if not exists meta_insights (
  id                uuid primary key default gen_random_uuid(),
  metric            text not null,               -- ex: 'follower_count', 'reach', 'profile_views'
  period            text not null default 'day', -- 'day' | 'week' | 'days_28' | 'lifetime'
  value              numeric,
  raw               jsonb,
  captured_at       timestamptz not null default now()
);

create index if not exists idx_meta_insights_metric on meta_insights (metric, captured_at desc);

-- ============================================================
-- INTEGRATION_LOGS: log de chamadas feitas pelo Claude Code do
-- cliente (ou por qualquer integração) via MCP, para auditoria e
-- para devolver erros claros ("o que faltou e onde").
-- ============================================================
create table if not exists integration_logs (
  id                uuid primary key default gen_random_uuid(),
  integration        text not null,              -- 'claude_code' | 'meta' | 'gemini'
  actor             text,                        -- identificador do cliente/chamador
  tool              text,                        -- nome da tool/endpoint chamado
  request_payload   jsonb,
  status            text not null check (status in ('ok', 'error')),
  message           text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_integration_logs_created_at on integration_logs (created_at desc);

-- trigger simples para manter updated_at em dia
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_videos_updated_at on videos;
create trigger trg_videos_updated_at before update on videos
  for each row execute procedure set_updated_at();

drop trigger if exists trg_scripts_updated_at on scripts;
create trigger trg_scripts_updated_at before update on scripts
  for each row execute procedure set_updated_at();
