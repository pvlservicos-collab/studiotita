/**
 * Nomes em português e unidades das métricas da Meta. Usado pelo painel e
 * pelo guia do MCP, para o Claude do Augusto ler os números igual à tela.
 */

export type MetricUnit = "count" | "ms" | "percent";

export const VIDEO_METRICS: { key: string; label: string; unit: MetricUnit; hint?: string }[] = [
  { key: "views", label: "Visualizações", unit: "count" },
  { key: "reach", label: "Alcance", unit: "count", hint: "contas únicas que viram" },
  { key: "likes", label: "Curtidas", unit: "count" },
  { key: "comments", label: "Comentários", unit: "count" },
  { key: "shares", label: "Compartilhamentos", unit: "count" },
  { key: "saved", label: "Salvamentos", unit: "count" },
  { key: "reposts", label: "Reposts", unit: "count" },
  { key: "total_interactions", label: "Interações", unit: "count", hint: "curtidas + comentários + compart. + salv." },
  { key: "ig_reels_avg_watch_time", label: "Tempo médio assistido", unit: "ms" },
  { key: "ig_reels_video_view_total_time", label: "Tempo total assistido", unit: "ms" },
  { key: "reels_skip_rate", label: "Taxa de pulo", unit: "percent", hint: "% que pulou nos primeiros segundos" },
  { key: "facebook_views", label: "Views no Facebook", unit: "count" },
  { key: "crossposted_views", label: "Views em crosspost", unit: "count" },
  { key: "total_views", label: "Views totais (IG + FB)", unit: "count" },
];

export const ACCOUNT_METRICS: Record<string, string> = {
  views: "Visualizações",
  reach: "Alcance",
  accounts_engaged: "Contas engajadas",
  total_interactions: "Interações",
  likes: "Curtidas",
  comments: "Comentários",
  shares: "Compartilhamentos",
  saves: "Salvamentos",
  replies: "Respostas (stories)",
  reposts: "Reposts",
  profile_views: "Visitas ao perfil",
  website_clicks: "Cliques no link da bio",
  profile_links_taps: "Toques em botões do perfil",
};

export const BREAKDOWN_LABELS: Record<string, string> = {
  FOLLOWER: "Seguidores",
  NON_FOLLOWER: "Não seguidores",
  REEL: "Reels",
  STORY: "Stories",
  POST: "Posts",
  CAROUSEL_CONTAINER: "Carrosséis",
  AD: "Anúncios",
  IGTV: "IGTV",
  F: "Mulheres",
  M: "Homens",
  U: "Não informado",
};

export function formatCount(n: number | null | undefined, compact = true) {
  if (n == null) return "—";
  return new Intl.NumberFormat("pt-BR", compact ? { notation: "compact", maximumFractionDigits: 1 } : {}).format(n);
}

/** Forma curta para espaços apertados (cards): 15,8k · 1,2M. */
export function formatShort(n: number | null | undefined) {
  if (n == null) return "—";
  const fmt = (v: number, suffix: string) => `${(Math.round(v * 10) / 10).toString().replace(".", ",")}${suffix}`;
  if (Math.abs(n) >= 1_000_000) return fmt(n / 1_000_000, "M");
  if (Math.abs(n) >= 1_000) return fmt(n / 1_000, "k");
  return String(n);
}

export function formatDuration(ms: number | null | undefined) {
  if (ms == null) return "—";
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1).replace(".", ",")}s`;
  const min = s / 60;
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  return h < 24 ? `${h.toFixed(1).replace(".", ",")} h` : `${Math.round(h / 24)} dias`;
}

export function formatMetric(value: number | null | undefined, unit: MetricUnit, compact = true) {
  if (value == null) return "—";
  if (unit === "ms") return formatDuration(value);
  if (unit === "percent") return `${value.toFixed(1).replace(".", ",")}%`;
  return formatCount(value, compact);
}
