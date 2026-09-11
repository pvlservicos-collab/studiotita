/**
 * Integração com a Facebook Graph API para trazer os vídeos (media) e os
 * insights da conta profissional do Instagram conectada.
 *
 * Requer no .env.local:
 *   FACEBOOK_ACCESS_TOKEN  — token da Página ligada ao Instagram (não expira)
 *   FACEBOOK_IG_USER_ID    — ID da conta profissional do Instagram
 *
 * Referência: https://developers.facebook.com/docs/instagram-platform
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

async function graphRequest(
  method: "GET" | "POST" | "DELETE",
  path: string,
  params: Record<string, string> = {}
) {
  const { token } = requireConfig();
  const url = new URL(path.startsWith("http") ? path : `${GRAPH_API_BASE}/${path.replace(/^\//, "")}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString(), { method });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new MetaRequestError(
      `Erro da Graph API em ${path}: ${data?.error?.message || res.statusText}`
    );
  }
  return data;
}

const graphGet = (path: string, params: Record<string, string>) => graphRequest("GET", path, params);

/**
 * Chamada livre à Graph API com o token da Página — usada pelo MCP para o
 * Claude do Augusto acessar tudo o que as permissões do app liberam.
 */
export async function metaGraphRequest(
  method: "GET" | "POST" | "DELETE",
  path: string,
  params: Record<string, string> = {}
) {
  return graphRequest(method, path, params);
}

export function metaIds() {
  const { igUserId } = requireConfig();
  return { igUserId, pageId: process.env.FACEBOOK_PAGE_ID ?? null, graphVersion: GRAPH_API_VERSION };
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

/** Posts mais recentes, paginando até `limit` (a conta pode ter centenas). */
export async function fetchRecentMedia(limit = 25): Promise<MetaMedia[]> {
  const { igUserId } = requireConfig();
  const items: MetaMedia[] = [];
  let data = await graphGet(`${igUserId}/media`, {
    fields: MEDIA_FIELDS,
    limit: String(Math.min(limit, 100)),
  });
  items.push(...(data.data as MetaMedia[]));
  while (items.length < limit && data.paging?.next) {
    data = await graphGet(data.paging.next, {});
    items.push(...(data.data as MetaMedia[]));
  }
  return items.slice(0, limit);
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
const BASE_MEDIA_METRICS = ["views", "reach", "likes", "comments", "shares", "saved", "total_interactions"];
// Testadas uma a uma contra um reel real; follows/profile_visits não existem para reels.
const REELS_EXTRA_METRICS = [
  "reposts",
  "ig_reels_avg_watch_time",
  "ig_reels_video_view_total_time",
  "reels_skip_rate",
  "facebook_views",
  "crossposted_views",
  "total_views",
];

/**
 * Métricas de uma mídia. Unidades: ig_reels_avg_watch_time e
 * ig_reels_video_view_total_time em milissegundos; reels_skip_rate em %.
 */
export async function fetchMediaInsights(mediaId: string, productType?: string) {
  const metrics = productType === "REELS" ? [...BASE_MEDIA_METRICS, ...REELS_EXTRA_METRICS] : BASE_MEDIA_METRICS;
  const data = await graphGet(`${mediaId}/insights`, { metric: metrics.join(",") });
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
    fields: "followers_count,follows_count,media_count,username,name,biography,website,profile_picture_url",
  });
  return data as {
    followers_count: number;
    follows_count: number;
    media_count: number;
    username: string;
    name: string;
    biography: string;
    website?: string;
    profile_picture_url?: string;
  };
}

// ---------------------------------------------------------------------------
// Painel completo de métricas da conta (aba Métricas e MCP)
// ---------------------------------------------------------------------------

// Totais que a Meta aceita com metric_type=total_value (testadas uma a uma).
const ACCOUNT_TOTAL_METRICS = [
  "views",
  "reach",
  "accounts_engaged",
  "total_interactions",
  "likes",
  "comments",
  "shares",
  "saves",
  "replies",
  "reposts",
  "profile_views",
  "website_clicks",
  "profile_links_taps",
];

const BREAKDOWNS: { key: string; metric: string; breakdown: string }[] = [
  { key: "reach_by_follow_type", metric: "reach", breakdown: "follow_type" },
  { key: "reach_by_media_type", metric: "reach", breakdown: "media_product_type" },
  { key: "views_by_media_type", metric: "views", breakdown: "media_product_type" },
  { key: "interactions_by_media_type", metric: "total_interactions", breakdown: "media_product_type" },
  { key: "follows_and_unfollows", metric: "follows_and_unfollows", breakdown: "follow_type" },
];

const DEMOGRAPHIC_BREAKDOWNS = ["age", "gender", "city", "country"] as const;

type Breakdown = { label: string; value: number }[];

function readBreakdown(data: any): Breakdown {
  const results = data?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
  return results
    .map((r: any) => ({
      // A Meta devolve cidades como "Ribeirão Prêto, São Paulo (state)".
      label: (r.dimension_values?.join(" / ") ?? "?").replace(/ \(state\)$/, ""),
      value: r.value ?? 0,
    }))
    .sort((a: any, b: any) => b.value - a.value);
}

export interface AccountMetrics {
  period: { days: number; since: string; until: string };
  profile: Awaited<ReturnType<typeof fetchAccountSummary>>;
  totals: Record<string, number>;
  breakdowns: Record<string, Breakdown>;
  daily: { reach: { date: string; value: number }[]; follower_count: { date: string; value: number }[] };
  demographics: {
    followers: Record<(typeof DEMOGRAPHIC_BREAKDOWNS)[number], Breakdown>;
    engaged_this_month: Record<(typeof DEMOGRAPHIC_BREAKDOWNS)[number], Breakdown>;
  };
  errors: string[];
}

/**
 * Tudo o que a Meta informa sobre a conta num período de 1 a 28 dias.
 * Cada bloco é buscado separado: se um falhar, os outros continuam e o erro
 * vai para `errors`.
 */
export async function fetchAccountMetrics(days = 28): Promise<AccountMetrics> {
  const { igUserId } = requireConfig();
  const safeDays = Math.min(Math.max(Math.round(days), 1), 28);
  const until = Math.floor(Date.now() / 1000);
  const since = until - safeDays * 86400;
  const range = { since: String(since), until: String(until) };
  const errors: string[] = [];

  const attempt = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      errors.push(`${label}: ${(err as Error).message}`);
      return fallback;
    }
  };

  const insights = (params: Record<string, string>) => graphGet(`${igUserId}/insights`, params);

  const [profile, totalsData, dailyData, breakdownData, followerDemo, engagedDemo] = await Promise.all([
    fetchAccountSummary(),
    attempt(
      "totais",
      () => insights({ metric: ACCOUNT_TOTAL_METRICS.join(","), period: "day", metric_type: "total_value", ...range }),
      null as any
    ),
    attempt("série diária", () => insights({ metric: "reach,follower_count", period: "day", ...range }), null as any),
    Promise.all(
      BREAKDOWNS.map((b) =>
        attempt(
          b.key,
          () => insights({ metric: b.metric, period: "day", metric_type: "total_value", breakdown: b.breakdown, ...range }),
          null as any
        )
      )
    ),
    Promise.all(
      DEMOGRAPHIC_BREAKDOWNS.map((b) =>
        attempt(
          `seguidores/${b}`,
          () => insights({ metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown: b }),
          null as any
        )
      )
    ),
    Promise.all(
      DEMOGRAPHIC_BREAKDOWNS.map((b) =>
        attempt(
          `engajados/${b}`,
          () =>
            insights({
              metric: "engaged_audience_demographics",
              period: "lifetime",
              metric_type: "total_value",
              breakdown: b,
              timeframe: "this_month",
            }),
          null as any
        )
      )
    ),
  ]);

  const totals: Record<string, number> = {};
  for (const item of totalsData?.data ?? []) {
    if (item.total_value?.value != null) totals[item.name] = item.total_value.value;
  }

  const breakdowns: Record<string, Breakdown> = {};
  BREAKDOWNS.forEach((b, i) => {
    breakdowns[b.key] = readBreakdown(breakdownData[i]);
  });

  const series = (name: string) =>
    (dailyData?.data ?? [])
      .find((d: any) => d.name === name)
      ?.values?.map((v: any) => ({ date: v.end_time?.slice(0, 10), value: v.value ?? 0 })) ?? [];

  const demo = (list: any[]) =>
    Object.fromEntries(DEMOGRAPHIC_BREAKDOWNS.map((b, i) => [b, readBreakdown(list[i])])) as Record<
      (typeof DEMOGRAPHIC_BREAKDOWNS)[number],
      Breakdown
    >;

  return {
    period: {
      days: safeDays,
      since: new Date(since * 1000).toISOString(),
      until: new Date(until * 1000).toISOString(),
    },
    profile,
    totals,
    breakdowns,
    daily: { reach: series("reach"), follower_count: series("follower_count") },
    demographics: { followers: demo(followerDemo), engaged_this_month: demo(engagedDemo) },
    errors,
  };
}
