/**
 * Busca de hashtags. A Meta permite 30 hashtags diferentes a cada 7 dias
 * por conta; repetir uma já buscada na semana não conta de novo. O controle
 * fica aqui para o painel avisar antes de estourar o limite.
 */
import { query, queryOne } from "@/lib/db";
import { fetchHashtagId, fetchHashtagMedia, fetchRecentlySearchedHashtags } from "@/lib/meta";
import { upsertExternalMedia } from "@/lib/services/externalMedia";

export const HASHTAG_WEEKLY_LIMIT = 30;

export class HashtagInputError extends Error {}

export function normalizeHashtag(input: string) {
  const tag = input.trim().replace(/^#/, "").toLocaleLowerCase("pt-BR");
  if (!/^[\p{L}\p{N}_]{1,100}$/u.test(tag)) throw new HashtagInputError("Digite uma hashtag só com letras, números ou _ (sem espaços).");
  return tag;
}

/** Cota da semana: junta o que a Meta informa (fonte oficial) com o histórico local. */
export async function getHashtagQuota() {
  const rows = await query<{ hashtag: string }>(
    `select distinct hashtag from hashtag_searches where searched_at > now() - interval '7 days'`
  );
  const fromMeta = await fetchRecentlySearchedHashtags().catch(() => [] as string[]);
  const all = Array.from(new Set([...fromMeta, ...rows.map((r) => r.hashtag)]));
  return { used: all.length, limit: HASHTAG_WEEKLY_LIMIT, hashtags_this_week: all };
}

export async function listHashtagSearches() {
  return query<{ hashtag: string; last_searched_at: string; searches: number; posts: number }>(
    `select h.hashtag, max(h.searched_at) as last_searched_at, count(*)::int as searches,
            (select count(*)::int from videos v where v.hashtag = h.hashtag) as posts
     from hashtag_searches h
     group by h.hashtag
     order by max(h.searched_at) desc`
  );
}

export async function searchHashtag(input: string, edge: "top_media" | "recent_media" = "top_media", limit = 50) {
  const hashtag = normalizeHashtag(input);
  const quota = await getHashtagQuota();
  const alreadyThisWeek = quota.hashtags_this_week.includes(hashtag);
  if (!alreadyThisWeek && quota.used >= HASHTAG_WEEKLY_LIMIT) {
    throw new HashtagInputError(
      `Limite da Meta atingido: ${quota.used} de ${HASHTAG_WEEKLY_LIMIT} hashtags diferentes nos últimos 7 dias. Repita uma hashtag já buscada ou espere a janela liberar.`
    );
  }

  // o id da hashtag não muda: reaproveita para não chamar a busca de novo
  const known = await queryOne<{ ig_hashtag_id: string }>(
    `select ig_hashtag_id from hashtag_searches where hashtag = $1 and ig_hashtag_id is not null limit 1`,
    [hashtag]
  );
  const hashtagId = known?.ig_hashtag_id ?? (await fetchHashtagId(hashtag));
  // a Meta recusa páginas grandes nesse endpoint: vem de 5 em 5 até chegar ao limite
  const media = await fetchHashtagMedia(hashtagId, edge, limit);
  await upsertExternalMedia(media, { source: "hashtag", hashtag });
  await query(
    `insert into hashtag_searches (hashtag, ig_hashtag_id, edge, result_count) values ($1, $2, $3, $4)`,
    [hashtag, hashtagId, edge, media.length]
  );
  return { hashtag, edge, posts: media.length, quota: await getHashtagQuota() };
}
