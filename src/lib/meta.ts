/**
 * Integração com a Facebook Graph API para trazer os vídeos (media) e os
 * insights da conta profissional do Instagram conectada.
 *
 * Requer no .env.local:
 *   FACEBOOK_ACCESS_TOKEN  — token de acesso de longa duração (page/IG)
 *   FACEBOOK_IG_USER_ID    — ID da conta profissional do Instagram
 *
 * Referência: https://developers.facebook.com/docs/instagram-api
 */

const GRAPH_API_VERSION = process.env.FACEBOOK_GRAPH_VERSION || "v23.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export class MetaConfigError extends Error {}
export class MetaRequestError extends Error {}

function requireConfig() {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  const igUserId = process.env.FACEBOOK_IG_USER_ID;
  if (!token || !igUserId) {
    const missing = [
      !token && "FACEBOOK_ACCESS_TOKEN",
      !igUserId && "FACEBOOK_IG_USER_ID",
    ].filter(Boolean);
    throw new MetaConfigError(
      `Configuração da Meta Graph API incompleta. Faltando: ${missing.join(", ")} (veja .env.example).`
    );
  }
  return { token, igUserId };
}

async function graphGet(path: string, params: Record<string, string>) {
  const { token } = requireConfig();
  const url = new URL(`${GRAPH_API_BASE}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new MetaRequestError(
      `Erro da Graph API em ${path}: ${data?.error?.message || res.statusText}`
    );
  }
  return data;
}

export interface MetaMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
}

const MEDIA_FIELDS = "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp";

export async function fetchRecentMedia(limit = 25): Promise<MetaMedia[]> {
  const { igUserId } = requireConfig();
  const data = await graphGet(`${igUserId}/media`, {
    fields: MEDIA_FIELDS,
    limit: String(limit),
  });
  return data.data as MetaMedia[];
}

/**
 * O media_url do Instagram é um link assinado que expira em poucos dias —
 * busque um novo antes de baixar o vídeo.
 */
export async function fetchMediaUrl(mediaId: string): Promise<string | null> {
  const data = await graphGet(mediaId, { fields: "media_url" });
  return data.media_url ?? null;
}

// "plays" foi descontinuada pela Meta; "views" é a métrica de visualizações atual.
const BASE_MEDIA_METRICS = "views,reach,likes,comments,shares,saved,total_interactions";
const REELS_METRICS = "ig_reels_avg_watch_time,ig_reels_video_view_total_time";

export async function fetchMediaInsights(mediaId: string, productType?: string) {
  const metric = productType === "REELS" ? `${BASE_MEDIA_METRICS},${REELS_METRICS}` : BASE_MEDIA_METRICS;
  const data = await graphGet(`${mediaId}/insights`, { metric });
  const values: Record<string, number> = {};
  for (const item of data.data ?? []) {
    values[item.name] = item.values?.[0]?.value ?? item.total_value?.value ?? 0;
  }
  return values;
}

export interface AccountInsight {
  name: string;
  period: string;
  value: number;
}

/**
 * Métricas da conta no último dia. A Meta exige metric_type=total_value para
 * a maioria delas; só reach e follower_count ainda saem como série diária.
 */
export async function fetchAccountInsights(): Promise<AccountInsight[]> {
  const { igUserId } = requireConfig();
  const [series, totals] = await Promise.all([
    graphGet(`${igUserId}/insights`, { metric: "reach,follower_count", period: "day" }),
    graphGet(`${igUserId}/insights`, {
      metric: "views,accounts_engaged,total_interactions,profile_views,website_clicks",
      period: "day",
      metric_type: "total_value",
    }),
  ]);

  const rows: AccountInsight[] = [];
  for (const item of series.data ?? []) {
    rows.push({ name: item.name, period: item.period, value: item.values?.at(-1)?.value ?? 0 });
  }
  for (const item of totals.data ?? []) {
    rows.push({ name: item.name, period: item.period, value: item.total_value?.value ?? 0 });
  }
  return rows;
}

export async function fetchAccountSummary() {
  const { igUserId } = requireConfig();
  const data = await graphGet(igUserId, {
    fields: "followers_count,follows_count,media_count,username,name,biography",
  });
  return data as {
    followers_count: number;
    follows_count: number;
    media_count: number;
    username: string;
    name: string;
    biography: string;
  };
}
