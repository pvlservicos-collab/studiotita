"use client";

import { GlassCard, ProgressBar } from "@/components/ui";
import { formatCount, formatDuration, formatShort } from "@/lib/metricLabels";
import type { AnalysisStatus, VideoRow } from "@/lib/types";

export type PollState = { status: AnalysisStatus; startedAt: number; elapsed: number; error?: string | null };

export const isBusy = (s?: AnalysisStatus | null) => s === "pending" || s === "processing";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(d));
}

export function originLabel(v: VideoRow) {
  if (v.source === "competitor") return `@${v.competitor_username ?? "concorrente"}`;
  if (v.source === "hashtag") return `#${v.hashtag}`;
  return null;
}

/** Card vertical estilo Instagram: métricas no topo, capa 9:16, legenda e botões embaixo. */
export default function VideoCard({
  video,
  poll,
  onOpen,
  extra,
  dimmed = false,
}: {
  video: VideoRow;
  poll?: PollState;
  onOpen: () => void;
  /** conteúdo extra no rodapé do card (ex.: botão de seleção da categoria) */
  extra?: React.ReactNode;
  dimmed?: boolean;
}) {
  const status = poll?.status ?? video.latest_analysis_status;
  const busy = isBusy(status);
  const m = video.metrics ?? {};
  const isImage = video.media_type === "IMAGE" || video.media_type === "CAROUSEL_ALBUM";
  const origin = originLabel(video);

  return (
    <GlassCard strong className={`flex flex-col overflow-hidden transition ${dimmed ? "opacity-45" : ""}`}>
      {/* métricas no topo do card */}
      <div className="space-y-1.5 px-3 pb-2 pt-3">
        <div className="flex justify-between gap-1.5 text-ink-800">
          <Stat icon={<EyeIcon />} value={video.views} title="Visualizações" />
          <Stat icon={<HeartIcon />} value={video.likes} title="Curtidas" />
          <Stat icon={<CommentIcon />} value={video.comments} title="Comentários" />
          <Stat icon={<BookmarkIcon />} value={video.saves} title="Salvamentos" />
        </div>
        <div className="flex min-h-[15px] flex-wrap gap-x-2 gap-y-0.5 text-[10.5px] text-ink-400">
          {video.shares != null && <span title={`Compartilhamentos: ${formatCount(video.shares, false)}`}>↗ {formatShort(video.shares)}</span>}
          {video.reach != null && <span title={`Alcance: ${formatCount(video.reach, false)}`}>alc. {formatShort(video.reach)}</span>}
          {m.ig_reels_avg_watch_time != null && <span title="Tempo médio assistido">⏱ {formatDuration(m.ig_reels_avg_watch_time)}</span>}
          {m.reels_skip_rate != null && <span title="Taxa de pulo">pulo {Math.round(m.reels_skip_rate)}%</span>}
          {origin && <span className="font-medium text-ink-500">{origin}</span>}
        </div>
      </div>

      {/* capa vertical 9:16 */}
      <button onClick={onOpen} className="group relative block aspect-[9/16] w-full overflow-hidden bg-ink-100">
        {video.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-ink-400">sem capa</div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur">
          {formatDate(video.posted_at)}
        </span>
        {status === "done" && (
          <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-semibold text-ink-800 shadow">
            ✦ Gemini
          </span>
        )}
        {status === "error" && (
          <span className="absolute right-2 top-2 rounded-full bg-rose-500/90 px-2 py-0.5 text-[10.5px] font-semibold text-white">erro</span>
        )}
        {isImage && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] text-white">imagem</span>
        )}
        {busy && (
          <div className="absolute inset-x-0 bottom-0 space-y-1.5 bg-gradient-to-t from-black/75 to-transparent p-3 pt-8">
            <div className="flex justify-between text-[11px] text-white">
              <span>Gemini analisando...</span>
              <span className="font-mono">{poll?.elapsed ?? 0}s</span>
            </div>
            <ProgressBar progress={0} indeterminate />
          </div>
        )}
      </button>

      <p className="line-clamp-2 min-h-[2.5rem] px-3 pt-2 text-xs leading-snug text-ink-700">
        {video.caption || <span className="text-ink-400">Sem legenda</span>}
      </p>
      {video.latest_analysis_categories && video.latest_analysis_categories.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 pt-1.5">
          {video.latest_analysis_categories.slice(0, 3).map((c) => (
            <span key={c} className="rounded-full bg-gold-50 px-1.5 py-0.5 text-[10px] text-gold-700" title="Categoria gerada pelo Gemini">
              {c}
            </span>
          ))}
        </div>
      )}

      {/* botões embaixo */}
      <div className="mt-auto flex gap-1.5 p-3 pt-2">
        <button
          onClick={onOpen}
          className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${
            status === "done" || isImage ? "border border-gold-300 bg-white text-gold-700 hover:bg-gold-50" : "btn-gold"
          }`}
        >
          {busy ? "Acompanhar" : status === "done" ? "Ver análise" : isImage ? "Ver post" : "Analisar com Gemini"}
        </button>
        {video.permalink && (
          <a
            href={video.permalink}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir no Instagram"
            className="flex items-center rounded-lg border border-ink-200 bg-white px-2.5 text-xs text-ink-600 hover:bg-ink-50"
          >
            ↗
          </a>
        )}
      </div>
      {extra && <div className="border-t border-ink-100 px-3 py-2">{extra}</div>}
    </GlassCard>
  );
}

function Stat({ icon, value, title }: { icon: React.ReactNode; value: number | null; title: string }) {
  return (
    <div className="flex items-center gap-1 whitespace-nowrap" title={value == null ? `${title}: a Meta não informa` : `${title}: ${formatCount(value, false)}`}>
      <span className="text-ink-500">{icon}</span>
      <span className={`text-xs font-semibold ${value == null ? "text-ink-300" : ""}`}>{formatShort(value)}</span>
    </div>
  );
}

const iconProps = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
const EyeIcon = () => (
  <svg {...iconProps}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const HeartIcon = () => (
  <svg {...iconProps}>
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
  </svg>
);
const CommentIcon = () => (
  <svg {...iconProps}>
    <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2-5.4A8.5 8.5 0 1 1 21 11.5Z" />
  </svg>
);
const BookmarkIcon = () => (
  <svg {...iconProps}>
    <path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z" />
  </svg>
);
