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

const GRAPH_API_VERSION = process.env.FACEBOOK_GRAPH_VERSION || "v21.0";
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
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
}

export async function fetchRecentMedia(limit = 25): Promise<MetaMedia[]> {
  const { igUserId } = requireConfig();
  const data = await graphGet(`${igUserId}/media`, {
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
    limit: String(limit),
  });
  return data.data as MetaMedia[];
}

export async function fetchMediaInsights(mediaId: string) {
  // Métricas variam por tipo de mídia; para vídeo/reels pedimos as mais comuns.
  const data = await graphGet(`${mediaId}/insights`, {
    metric: "plays,reach,likes,comments,shares,saved,total_interactions",
  });
  const values: Record<string, number> = {};
  for (const item of data.data ?? []) {
    values[item.name] = item.values?.[0]?.value ?? 0;
  }
  return values;
}

export async function fetchAccountInsights(period: "day" | "week" | "days_28" = "day") {
  const { igUserId } = requireConfig();
  const data = await graphGet(`${igUserId}/insights`, {
    metric: "reach,profile_views,follower_count,website_clicks",
    period,
  });
  return data.data as Array<{ name: string; period: string; values: { value: number }[] }>;
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
