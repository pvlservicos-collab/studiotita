/**
 * Concorrentes: contas profissionais acompanhadas via Business Discovery.
 * Tudo é leitura oficial da API, feita só quando alguém pede (adicionar ou
 * atualizar), então não há risco para a conta do Augusto.
 */
import { query, queryOne } from "@/lib/db";
import { fetchBusinessDiscovery, MetaRequestError } from "@/lib/meta";
import { upsertExternalMedia } from "@/lib/services/externalMedia";
import type { CompetitorRow } from "@/lib/types";

export class CompetitorInputError extends Error {}

const RESERVED = new Set(["p", "reel", "reels", "stories", "explore", "tv", "accounts", "direct"]);

/** Aceita links do Instagram, @usuario ou só o usuário — vários por linha, vírgula ou espaço. */
export function parseInstagramInput(input: string): string[] {
  const out = new Set<string>();
  for (const raw of input.split(/[\s,;]+/)) {
    const token = raw.trim();
    if (!token) continue;
    const fromUrl = token.match(/instagram\.com\/([^/?#]+)/i)?.[1];
    const username = (fromUrl ?? token).replace(/^@/, "").toLowerCase();
    if (/^[a-z0-9._]{1,30}$/.test(username) && !RESERVED.has(username)) out.add(username);
  }
  return Array.from(out);
}

const STATS = `
  coalesce(s.video_count, 0)::int as video_count, s.avg_views, s.avg_likes, s.avg_comments`;
const STATS_JOIN = `
  left join lateral (
    select count(*) as video_count,
           round(avg(views))::int as avg_views, round(avg(likes))::int as avg_likes, round(avg(comments))::int as avg_comments
    from (select views, likes, comments from videos v where v.competitor_id = c.id order by posted_at desc limit 30) last30
  ) s on true`;

export async function listCompetitors(): Promise<CompetitorRow[]> {
  return query<CompetitorRow>(`select c.*, ${STATS} from competitors c ${STATS_JOIN} order by c.followers_count desc nulls last`);
}

export async function getCompetitor(id: string): Promise<CompetitorRow | null> {
  return queryOne<CompetitorRow>(`select c.*, ${STATS} from competitors c ${STATS_JOIN} where c.id = $1`, [id]);
}

/** Médias dos últimos 30 vídeos do Augusto, para comparar lado a lado. */
export async function getOwnStats() {
  return queryOne<{ video_count: number; avg_views: number | null; avg_likes: number | null; avg_comments: number | null }>(
    `select count(*)::int as video_count, round(avg(views))::int as avg_views,
            round(avg(likes))::int as avg_likes, round(avg(comments))::int as avg_comments
     from (select views, likes, comments from videos
           where competitor_id is null and source in ('meta', 'manual', 'claude_code')
           order by posted_at desc nulls last limit 30) last30`
  );
}

async function saveProfile(profile: Awaited<ReturnType<typeof fetchBusinessDiscovery>>["profile"]) {
  return queryOne<CompetitorRow>(
    `insert into competitors (username, name, biography, website, followers_count, follows_count, media_count, profile_picture_url, last_synced_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now())
     on conflict (username) do update set
       name = excluded.name, biography = excluded.biography, website = excluded.website,
       followers_count = excluded.followers_count, follows_count = excluded.follows_count,
       media_count = excluded.media_count, profile_picture_url = excluded.profile_picture_url,
       last_synced_at = now()
     returning *`,
    [
      profile.username.toLowerCase(),
      profile.name ?? null,
      profile.biography ?? null,
      profile.website ?? null,
      profile.followers_count ?? null,
      profile.follows_count ?? null,
      profile.media_count ?? null,
      profile.profile_picture_url ?? null,
    ]
  );
}

/** Adiciona (ou atualiza) um concorrente e puxa os posts recentes. Só vídeos entram na videoteca. */
export async function syncCompetitorByUsername(username: string, mediaLimit = 50) {
  const { profile, media } = await fetchBusinessDiscovery(username, mediaLimit);
  const competitor = await saveProfile(profile);
  if (!competitor) throw new Error("Falha ao salvar concorrente.");
  const videos = media.filter((m) => m.media_type === "VIDEO" || m.media_product_type === "REELS");
  await upsertExternalMedia(videos, { source: "competitor", competitorId: competitor.id });
  return {
    competitor: (await getCompetitor(competitor.id))!,
    posts_lidos: media.length,
    videos_salvos: videos.length,
    videos_sem_arquivo: videos.filter((v) => !v.media_url).length,
  };
}

/** Adiciona vários concorrentes de uma vez (links ou @). Um erro não impede os outros. */
export async function addCompetitors(input: string) {
  const usernames = parseInstagramInput(input);
  if (!usernames.length) throw new CompetitorInputError("Cole links do Instagram ou @usuarios válidos.");
  const results = [];
  for (const username of usernames) {
    try {
      results.push({ username, ok: true, ...(await syncCompetitorByUsername(username)) });
    } catch (err) {
      results.push({ username, ok: false, error: (err as Error).message });
    }
  }
  return results;
}

export async function syncCompetitor(id: string, mediaLimit = 50) {
  const c = await queryOne<{ username: string }>(`select username from competitors where id = $1`, [id]);
  if (!c) throw new CompetitorInputError("Concorrente não encontrado.");
  return syncCompetitorByUsername(c.username, mediaLimit);
}

export async function removeCompetitor(id: string) {
  const row = await queryOne(`delete from competitors where id = $1 returning id`, [id]);
  return Boolean(row);
}

/**
 * Link novo do vídeo de um concorrente (o salvo expira em poucos dias).
 * A Meta não deixa ler a mídia de outra conta pelo id, então procuramos
 * nos posts recentes do perfil.
 */
export async function findCompetitorMediaUrl(competitorId: string, mediaId: string): Promise<string | null> {
  const c = await queryOne<{ username: string }>(`select username from competitors where id = $1`, [competitorId]);
  if (!c) return null;
  try {
    const { media } = await fetchBusinessDiscovery(c.username, 200);
    return media.find((m) => m.id === mediaId)?.media_url ?? null;
  } catch (err) {
    if (err instanceof MetaRequestError) return null;
    throw err;
  }
}
