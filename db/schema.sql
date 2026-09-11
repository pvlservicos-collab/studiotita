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

-- Todas as métricas que a Meta devolve para a mídia (views, alcance, tempo
-- médio assistido, taxa de pulo...), atualizadas a cada sincronização.
alter table videos add column if not exists metrics            jsonb;
alter table videos add column if not exists metrics_updated_at timestamptz;

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

-- Campos da análise v2: o prompt e o modelo usados ficam gravados em cada
-- análise (o Claude do Augusto pode mandar prompts diferentes), além da
-- transcrição e da adequação às regras do Augusto (preenchida depois, à mão
-- ou pelo Claude).
alter table analyses add column if not exists prompt       text;
alter table analyses add column if not exists model        text;
alter table analyses add column if not exists transcript   text;
alter table analyses add column if not exists rules_fit    text;
alter table analyses add column if not exists updated_at   timestamptz not null default now();

-- ============================================================
-- FILES: biblioteca de arquivos (roteiros antigos, transcrições de
-- aula etc.). O arquivo original fica no Vercel Blob e o texto
-- extraído fica em text_content, para o Claude ler e pesquisar.
-- ============================================================
create table if not exists files (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  category          text not null default 'outro',   -- 'roteiro_antigo' | 'transcricao_aula' | 'outro' (livre)
  description       text,
  blob_url          text,
  content_type      text,
  size_bytes        bigint,
  text_content      text,                            -- texto extraído (txt, md, docx, pdf) ou enviado pelo Claude
  source            text not null default 'upload',  -- 'upload' | 'claude_code'
  created_by        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_files_created_at on files (created_at desc);
create index if not exists idx_files_category on files (category);

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

-- ============================================================
-- v3: estrutura/gancho/categorias do Gemini, concorrentes, hashtags,
-- categorias com seleção, seções da biblioteca e exclusão de roteiros.
-- ============================================================

-- Campos que o Gemini gera junto com resumo e transcrição.
alter table analyses add column if not exists structure  text;    -- estrutura narrativa por parte/segundo
alter table analyses add column if not exists hook       text;    -- gancho: os primeiros segundos
alter table analyses add column if not exists categories text[];  -- temas do vídeo
create index if not exists idx_analyses_categories on analyses using gin (categories);

-- Contas concorrentes (só contas profissionais: a Meta não expõe contas pessoais).
create table if not exists competitors (
  id                  uuid primary key default gen_random_uuid(),
  username            text not null unique,
  name                text,
  biography           text,
  website             text,
  followers_count     bigint,
  follows_count       bigint,
  media_count         bigint,
  profile_picture_url text,
  notes               text,
  last_synced_at      timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Posts de concorrentes e de hashtags ficam em `videos`, para reaproveitar
-- análise, categorias e roteiros. Os do Augusto têm competitor_id e hashtag nulos.
alter table videos add column if not exists competitor_id uuid references competitors(id) on delete cascade;
alter table videos add column if not exists hashtag       text;
alter table videos drop constraint if exists videos_source_check;
alter table videos add constraint videos_source_check
  check (source in ('meta', 'manual', 'claude_code', 'competitor', 'hashtag'));
create index if not exists idx_videos_competitor on videos (competitor_id);
create index if not exists idx_videos_hashtag on videos (hashtag);

-- Histórico de buscas de hashtag: a Meta limita a 30 hashtags diferentes por 7 dias.
create table if not exists hashtag_searches (
  id             uuid primary key default gen_random_uuid(),
  hashtag        text not null,
  ig_hashtag_id  text,
  edge           text not null default 'top_media',   -- 'top_media' (em alta) | 'recent_media' (recentes)
  result_count   int,
  searched_at    timestamptz not null default now()
);
create index if not exists idx_hashtag_searches_at on hashtag_searches (searched_at desc);

-- Roteiros gerados pelo Gemini a partir de uma categoria.
alter table scripts add column if not exists category          text;
alter table scripts add column if not exists generation_prompt text;
alter table scripts drop constraint if exists scripts_source_check;
alter table scripts add constraint scripts_source_check
  check (source in ('manual', 'claude_code', 'gemini'));

-- v4: roteiros gerados guardam os vídeos de referência (para thumb e pontuação),
-- as cenas do Estúdio Reels e as opções usadas na geração.
alter table scripts add column if not exists source_video_ids   uuid[];
alter table scripts add column if not exists scenes             text;
alter table scripts add column if not exists generation_options jsonb;

-- Vídeos desligados da seleção de uma categoria (não entram no copiar/baixar/gerar).
create table if not exists category_selection (
  category    text not null,
  video_id    uuid not null references videos(id) on delete cascade,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now(),
  primary key (category, video_id)
);

-- Biblioteca: caminho de origem (importação da pasta "arquivos base") e
-- o texto dividido por títulos, para o Claude pedir uma parte específica.
alter table files add column if not exists source_path text;
create unique index if not exists idx_files_source_path on files (source_path) where source_path is not null;

create table if not exists file_sections (
  id          uuid primary key default gen_random_uuid(),
  file_id     uuid not null references files(id) on delete cascade,
  position    int not null,
  level       int not null default 1,
  title       text not null,
  content     text not null,
  char_count  int not null default 0
);
create index if not exists idx_file_sections_file on file_sections (file_id, position);

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

drop trigger if exists trg_analyses_updated_at on analyses;
create trigger trg_analyses_updated_at before update on analyses
  for each row execute procedure set_updated_at();

drop trigger if exists trg_files_updated_at on files;
create trigger trg_files_updated_at before update on files
  for each row execute procedure set_updated_at();

drop trigger if exists trg_competitors_updated_at on competitors;
create trigger trg_competitors_updated_at before update on competitors
  for each row execute procedure set_updated_at();
