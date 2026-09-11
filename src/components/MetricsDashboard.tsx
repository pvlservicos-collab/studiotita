"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassCard, EmptyState } from "@/components/ui";
import {
  ACCOUNT_METRICS,
  BREAKDOWN_LABELS,
  VIDEO_METRICS,
  formatCount,
  formatMetric,
} from "@/lib/metricLabels";
import type { AccountMetrics } from "@/lib/meta";
import type { VideoRow } from "@/lib/types";

// Uma série por gráfico → uma cor só. gold-600 passa 3:1 contra a superfície (gold-500 não).
const BAR_COLOR = "#a87c2c";

const PERIODS = [
  { days: 1, label: "Último dia" },
  { days: 7, label: "7 dias" },
  { days: 28, label: "28 dias" },
];

const FOLLOW_LABELS: Record<string, string> = { FOLLOWER: "Começaram a seguir", NON_FOLLOWER: "Deixaram de seguir" };

export default function MetricsDashboard() {
  const [days, setDays] = useState(28);
  const [metrics, setMetrics] = useState<AccountMetrics | null>(null);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/metrics?days=${days}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Erro ao buscar métricas.");
        if (!cancelled) setMetrics(data.metrics);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [days]);

  useEffect(() => {
    fetch("/api/videos")
      .then((r) => r.json())
      .then((d) => setVideos(d.videos ?? []));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
            <span className="gold-gradient-text">Métricas</span>
          </h1>
          <p className="mt-1 text-sm text-ink-500">Tudo o que a Meta informa sobre a conta, ao vivo, e o desempenho de cada vídeo.</p>
        </div>
        {/* filtro único, acima de tudo o que ele controla */}
        <div className="flex gap-1 rounded-full bg-white/60 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                days === p.days ? "btn-gold" : "text-ink-500 hover:bg-white hover:text-ink-800"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <GlassCard className="p-5 text-sm text-rose-600">{error}</GlassCard>}
      {!metrics && loading && <div className="p-8 text-center text-sm text-ink-400">Buscando métricas na Meta...</div>}

      {metrics && (
        // mantém o render anterior esmaecido durante a troca de período
        <div className={`space-y-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
          <ProfileStrip profile={metrics.profile} />

          <section>
            <SectionHeading title={`Conta · ${PERIODS.find((p) => p.days === metrics.period.days)?.label ?? `${metrics.period.days} dias`}`} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Object.entries(ACCOUNT_METRICS)
                .filter(([key]) => metrics.totals[key] != null)
                .map(([key, label]) => (
                  <GlassCard key={key} className="p-4">
                    <div className="text-xs text-ink-500">{label}</div>
                    <div className="mt-1 text-2xl font-semibold text-ink-900">{formatCount(metrics.totals[key])}</div>
                  </GlassCard>
                ))}
            </div>
          </section>

          {metrics.daily.reach.length > 1 && (
            <GlassCard strong className="p-5">
              <SectionHeading title="Alcance por dia" subtitle="Contas únicas alcançadas em cada dia do período" />
              <ColumnChart data={metrics.daily.reach} />
            </GlassCard>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownCard title="Alcance: seguidores × não seguidores" rows={metrics.breakdowns.reach_by_follow_type} />
            <BreakdownCard
              title="Seguidores ganhos e perdidos"
              rows={metrics.breakdowns.follows_and_unfollows}
              labels={FOLLOW_LABELS}
            />
            <BreakdownCard title="Visualizações por formato" rows={metrics.breakdowns.views_by_media_type} />
            <BreakdownCard title="Interações por formato" rows={metrics.breakdowns.interactions_by_media_type} />
          </div>

          <section>
            <SectionHeading title="Público (seguidores)" subtitle="Distribuição atual dos seguidores da conta" />
            <div className="grid gap-4 lg:grid-cols-2">
              <BreakdownCard title="Idade" rows={sortAge(metrics.demographics.followers.age)} />
              <BreakdownCard title="Gênero" rows={metrics.demographics.followers.gender} />
              <BreakdownCard title="Cidades (top 10)" rows={metrics.demographics.followers.city.slice(0, 10)} />
              <BreakdownCard title="Países (top 10)" rows={metrics.demographics.followers.country.slice(0, 10)} />
            </div>
          </section>

          {metrics.errors.length > 0 && (
            <GlassCard className="p-4 text-xs text-ink-500">
              <div className="mb-1 font-medium text-ink-700">A Meta não devolveu alguns blocos:</div>
              <ul className="list-disc space-y-0.5 pl-4">
                {metrics.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </GlassCard>
          )}
        </div>
      )}

      <VideoRanking videos={videos} />
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
      {subtitle && <p className="text-xs text-ink-400">{subtitle}</p>}
    </div>
  );
}

function ProfileStrip({ profile }: { profile: AccountMetrics["profile"] }) {
  return (
    <GlassCard strong className="flex flex-wrap items-center gap-5 p-5">
      {profile.profile_picture_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.profile_picture_url} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-gold-300" />
      )}
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-ink-900">@{profile.username}</div>
        <div className="text-xs text-ink-500">{profile.name}</div>
      </div>
      {[
        { label: "Seguidores", value: profile.followers_count },
        { label: "Seguindo", value: profile.follows_count },
        { label: "Publicações", value: profile.media_count },
      ].map((s) => (
        <div key={s.label} className="text-right">
          <div className="text-2xl font-semibold text-ink-900">{formatCount(s.value, false)}</div>
          <div className="text-xs text-ink-500">{s.label}</div>
        </div>
      ))}
    </GlassCard>
  );
}

function sortAge(rows: { label: string; value: number }[]) {
  return [...rows].sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true }));
}

/** Barras horizontais de uma série só, com o valor na ponta (sem legenda: o título diz o que é). */
function BreakdownCard({
  title,
  rows,
  labels = BREAKDOWN_LABELS,
}: {
  title: string;
  rows: { label: string; value: number }[];
  labels?: Record<string, string>;
}) {
  const visible = rows.filter((r) => r.value > 0);
  const max = Math.max(...visible.map((r) => r.value), 1);
  const total = visible.reduce((s, r) => s + r.value, 0);

  return (
    <GlassCard strong className="p-5">
      <SectionHeading title={title} />
      {visible.length === 0 ? (
        <p className="text-xs text-ink-400">Sem dados da Meta para este recorte.</p>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => (
            <div key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 text-xs">
              <span className="truncate text-ink-600" title={labels[r.label] ?? r.label}>
                {labels[r.label] ?? r.label}
              </span>
              <div className="flex items-center gap-2">
                <div className="h-3 flex-1">
                  <div
                    className="h-full rounded-r"
                    style={{ width: `${Math.max((r.value / max) * 100, 1)}%`, background: BAR_COLOR }}
                  />
                </div>
                <span className="w-32 shrink-0 whitespace-nowrap text-right tabular-nums text-ink-700">
                  {formatCount(r.value, false)}
                  <span className="text-ink-400"> · {Math.round((r.value / total) * 100)}%</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

/** Colunas diárias com tooltip no hover e tabela equivalente. */
function ColumnChart({ data }: { data: { date: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
  const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return (
    <div className="pt-4">
      <div className="flex gap-2">
        {/* eixo y */}
        <div className="relative h-48 w-12 shrink-0 text-right text-[10px] tabular-nums text-ink-400">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
              {formatCount(t)}
            </span>
          ))}
        </div>
        <div className="relative h-48 flex-1">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-ink-100" style={{ bottom: `${(t / top) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d, i) => (
              <div
                key={d.date}
                className="relative flex h-full flex-1 items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className="w-full max-w-[24px] rounded-t transition-opacity"
                  style={{
                    height: `${(d.value / top) * 100}%`,
                    background: BAR_COLOR,
                    opacity: hover == null || hover === i ? 1 : 0.45,
                  }}
                />
                {(i === peak || hover === i) && (
                  <div
                    className={`pointer-events-none absolute z-10 -translate-y-full whitespace-nowrap rounded-md px-2 py-1 text-[10px] ${
                      hover === i ? "bg-ink-900 text-white shadow" : "text-ink-600"
                    }`}
                    style={{ bottom: `${(d.value / top) * 100}%` }}
                  >
                    {hover === i ? `${fmtDay(d.date)} · ${formatCount(d.value, false)}` : `máx. ${formatCount(d.value)}`}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-14 mt-1 flex justify-between text-[10px] text-ink-400">
        <span>{fmtDay(data[0].date)}</span>
        <span>{fmtDay(data[data.length - 1].date)}</span>
      </div>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-ink-500">Ver em tabela</summary>
        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 tabular-nums text-ink-600 sm:grid-cols-4">
          {data.map((d) => (
            <div key={d.date} className="flex justify-between border-b border-ink-50 py-0.5">
              <span>{fmtDay(d.date)}</span>
              <span>{formatCount(d.value, false)}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function niceTicks(max: number) {
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const unit = [1, 2, 2.5, 5, 10].map((m) => m * step).find((u) => max / u <= 4) ?? step * 10;
  const ticks = [];
  for (let t = 0; t <= max + unit * 0.999; t += unit) ticks.push(Math.round(t));
  return ticks.length > 1 ? ticks : [0, Math.ceil(max)];
}

const RANKING_COLUMNS = VIDEO_METRICS.filter((m) =>
  ["views", "reach", "likes", "comments", "shares", "saved", "reposts", "ig_reels_avg_watch_time", "reels_skip_rate"].includes(m.key)
);

function metricValue(v: VideoRow, key: string): number | null {
  const m = v.metrics ?? {};
  if (m[key] != null) return m[key];
  const fallback: Record<string, number> = { views: v.views, reach: v.reach, likes: v.likes, comments: v.comments, shares: v.shares, saved: v.saves };
  return fallback[key] ?? null;
}

function VideoRanking({ videos }: { videos: VideoRow[] }) {
  const [sortKey, setSortKey] = useState("views");
  const sorted = useMemo(
    () => [...videos].sort((a, b) => (metricValue(b, sortKey) ?? -1) - (metricValue(a, sortKey) ?? -1)),
    [videos, sortKey]
  );

  return (
    <GlassCard strong className="overflow-hidden">
      <div className="p-5 pb-3">
        <SectionHeading title="Desempenho por vídeo" subtitle="Clique no nome de uma coluna para ordenar. Os números vêm da última sincronização com a Meta." />
      </div>
      {videos.length === 0 ? (
        <div className="p-5 pt-0">
          <EmptyState title="Nenhum vídeo sincronizado" description="Sincronize na aba Vídeos para ver o ranking." />
        </div>
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-ink-100 text-left text-ink-400">
                <th className="px-5 py-2 font-medium">Vídeo</th>
                {RANKING_COLUMNS.map((c) => (
                  <th key={c.key} className="px-2 py-2 text-right font-medium">
                    <button
                      onClick={() => setSortKey(c.key)}
                      className={`hover:text-ink-800 ${sortKey === c.key ? "font-semibold text-gold-700" : ""}`}
                      title={c.hint}
                    >
                      {c.label}
                      {sortKey === c.key && " ↓"}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((v) => (
                <tr key={v.id} className="border-b border-ink-50 hover:bg-white/60">
                  <td className="px-5 py-2">
                    <a
                      href={v.permalink ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-ink-700 hover:text-gold-700"
                    >
                      <span className="block h-10 w-6 shrink-0 overflow-hidden rounded bg-ink-100">
                        {v.thumbnail_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" />
                        )}
                      </span>
                      <span className="line-clamp-2 max-w-[240px]">{v.caption || "Sem legenda"}</span>
                    </a>
                  </td>
                  {RANKING_COLUMNS.map((c) => (
                    <td key={c.key} className="px-2 py-2 text-right tabular-nums text-ink-700">
                      {formatMetric(metricValue(v, c.key), c.unit)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
