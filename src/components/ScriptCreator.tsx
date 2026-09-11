"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard, Badge, ProgressBar, EmptyState } from "@/components/ui";
import { formatShort } from "@/lib/metricLabels";
import { PERIODS, periodRange, type PeriodId } from "@/lib/periods";
import type { ScriptRow } from "@/lib/types";

/** Vídeo já analisado pelo Gemini: é o que pode virar referência de um roteiro novo. */
type PickVideo = {
  video_id: string;
  caption: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  posted_at: string | null;
  source: string;
  competitor_username: string | null;
  hashtag: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  metrics: Record<string, number> | null;
  categories: string[] | null;
};

type Origem = "all" | "own" | "competitor";
type Ordem = "recent" | "views" | "likes" | "comments" | "shares" | "saves" | "engagement";

const ORDENS: { id: Ordem; label: string }[] = [
  { id: "recent", label: "Mais recentes" },
  { id: "views", label: "Mais visualizações" },
  { id: "likes", label: "Mais curtidas" },
  { id: "comments", label: "Mais comentários" },
  { id: "shares", label: "Mais compartilhamentos" },
  { id: "saves", label: "Mais salvamentos" },
  { id: "engagement", label: "Maior engajamento" },
];

const selectCls = "rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 outline-none";

const num = (x: number | null | undefined) => (typeof x === "number" ? x : 0);
function ordemValor(v: PickVideo, ordem: Ordem) {
  if (ordem === "recent") return new Date(v.posted_at ?? 0).getTime();
  if (ordem === "engagement") {
    const inter = v.metrics?.total_interactions ?? num(v.likes) + num(v.comments) + num(v.shares) + num(v.saves);
    const base = num(v.metrics?.reach) || num(v.views);
    return base ? (inter / base) * 100 : 0;
  }
  return num(v[ordem]);
}
const origemDe = (v: PickVideo) => (v.source === "competitor" ? `@${v.competitor_username}` : v.source === "hashtag" ? `#${v.hashtag}` : "@augustotita");

/** Tela "Criar roteiro": escolhe os vídeos de referência e manda ao Gemini. */
export default function ScriptCreator() {
  const [videos, setVideos] = useState<PickVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [origem, setOrigem] = useState<Origem>("all");
  const [categoria, setCategoria] = useState("");
  const [periodo, setPeriodo] = useState<PeriodId | "">("");
  const [ordem, setOrdem] = useState<Ordem>("views");
  const [busca, setBusca] = useState("");

  const [subject, setSubject] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [instructions, setInstructions] = useState("");
  const [scenes, setScenes] = useState(true);

  const [busy, setBusy] = useState<"random" | "custom" | "preview" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [script, setScript] = useState<ScriptRow | null>(null);
  const [preview, setPreview] = useState<{ prompt: string; references: number } | null>(null);

  useEffect(() => {
    fetch("/api/video-scripts?scope=all")
      .then((r) => r.json())
      .then((d) => setVideos(d.scripts ?? []))
      .finally(() => setLoading(false));
  }, []);

  const categorias = useMemo(() => {
    const set = new Set<string>();
    for (const v of videos) for (const c of v.categories ?? []) set.add(`${v.source === "competitor" ? `@${v.competitor_username}+` : ""}${c}`);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [videos]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const range = periodo ? periodRange(periodo) : null;
    return videos
      .filter((v) => (origem === "all" ? true : origem === "own" ? v.source !== "competitor" && v.source !== "hashtag" : v.source === "competitor" || v.source === "hashtag"))
      .filter((v) => !categoria || (v.categories ?? []).some((c) => `${v.source === "competitor" ? `@${v.competitor_username}+` : ""}${c}` === categoria))
      .filter((v) => {
        if (!range) return true;
        const d = new Date(v.posted_at ?? 0);
        return d >= range.since && d < range.until;
      })
      .filter((v) => !termo || (v.caption ?? "").toLowerCase().includes(termo) || (v.categories ?? []).join(" ").toLowerCase().includes(termo))
      .sort((a, b) => ordemValor(b, ordem) - ordemValor(a, ordem));
  }, [videos, origem, categoria, periodo, ordem, busca]);

  const escolhidos = videos.filter((v) => selected.has(v.video_id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function body(random: boolean) {
    if (random) return { random: true, scenes, instructions: instructions || null };
    return {
      videoIds: Array.from(selected),
      subject: subject.trim() || null,
      librarySearch: librarySearch.trim() || null,
      instructions: instructions.trim() || null,
      scenes,
    };
  }

  async function run(kind: "random" | "custom" | "preview") {
    setBusy(kind);
    setError(null);
    if (kind !== "preview") setScript(null);
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body(kind === "random"), preview: kind === "preview" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar roteiro.");
      if (kind === "preview") setPreview({ prompt: data.prompt, references: data.references });
      else {
        setScript(data.script);
        setPreview(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const podeGerar = selected.size > 0 || subject.trim() || librarySearch.trim() || instructions.trim();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
          Criar <span className="gold-gradient-text">roteiro</span>
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          O Gemini escreve um roteiro novo no método e na estrutura do Augusto (arquivos da Biblioteca), aprendendo com os vídeos que você
          escolher aqui.
        </p>
      </div>

      <GlassCard strong className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <div className="text-sm font-semibold text-ink-900">Roteiro aleatório</div>
          <p className="text-xs text-ink-500">Sorteia uma das suas categorias (ou seus melhores do trimestre) e um trecho das aulas como ponto de partida.</p>
        </div>
        <button onClick={() => run("random")} disabled={busy !== null} className="btn-gold rounded-xl px-5 py-2.5 text-sm font-semibold">
          {busy === "random" ? "Gemini escrevendo..." : "✦ Gerar roteiro aleatório"}
        </button>
      </GlassCard>

      {/* 1. vídeos de referência */}
      <GlassCard strong className="space-y-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gold-600">1. Escolha os vídeos de referência</h2>
            <p className="text-xs text-ink-500">
              Aparecem só os vídeos já analisados pelo Gemini (seus, de concorrentes e de hashtags). O roteiro novo aprende o padrão deles.
            </p>
          </div>
          <div className="text-sm text-ink-700">
            <strong>{selected.size}</strong> selecionados
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <select value={origem} onChange={(e) => setOrigem(e.target.value as Origem)} className={selectCls}>
            <option value="all">Todas as origens</option>
            <option value="own">Seus vídeos</option>
            <option value="competitor">Concorrentes e hashtags</option>
          </select>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={selectCls}>
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as PeriodId | "")} className={selectCls}>
            <option value="">Qualquer data</option>
            {PERIODS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className={selectCls}>
            {ORDENS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar na legenda ou na categoria..."
            className="min-w-[200px] flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-gold-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-ink-500">{visiveis.length} vídeos nesta lista:</span>
          {[3, 5, 10].map((n) => (
            <button
              key={n}
              onClick={() => setSelected(new Set([...Array.from(selected), ...visiveis.slice(0, n).map((v) => v.video_id)]))}
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 font-medium text-ink-700 hover:bg-ink-50"
            >
              + os {n} primeiros
            </button>
          ))}
          <button
            onClick={() => setSelected(new Set(visiveis.map((v) => v.video_id)))}
            className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 font-medium text-ink-700 hover:bg-ink-50"
          >
            Selecionar todos
          </button>
          <button onClick={() => setSelected(new Set())} disabled={!selected.size} className="rounded-lg px-3 py-1.5 font-medium text-ink-500 hover:bg-ink-100 disabled:opacity-40">
            Limpar seleção
          </button>
        </div>

        {escolhidos.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gold-50/70 p-2">
            {escolhidos.map((v) => (
              <button
                key={v.video_id}
                onClick={() => toggle(v.video_id)}
                title={`Tirar: ${(v.caption ?? "").slice(0, 60)}`}
                className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[11px] text-ink-700 shadow-sm hover:bg-rose-50"
              >
                <span className="block h-7 w-5 overflow-hidden rounded bg-ink-100">
                  {v.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="max-w-[140px] truncate">{(v.caption ?? "Sem legenda").split("\n")[0]}</span>
                <span className="text-ink-400">×</span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-sm text-ink-400">Carregando vídeos analisados...</div>
        ) : visiveis.length === 0 ? (
          <EmptyState
            title={videos.length ? "Nenhum vídeo com esses filtros" : "Nenhum vídeo analisado ainda"}
            description={videos.length ? "Troque a origem, a categoria ou o período." : "Analise vídeos com o Gemini em Posts ou na página de um concorrente."}
          />
        ) : (
          <div className="grid max-h-[540px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visiveis.map((v) => {
              const on = selected.has(v.video_id);
              return (
                <button
                  key={v.video_id}
                  onClick={() => toggle(v.video_id)}
                  className={`overflow-hidden rounded-xl border text-left transition ${on ? "border-gold-500 bg-gold-50/70 ring-2 ring-gold-300" : "border-ink-100 bg-white/70 hover:border-ink-200"}`}
                >
                  <div className="relative aspect-[9/16] w-full bg-ink-100">
                    {v.thumbnail_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                    <span className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border text-xs font-bold ${on ? "border-gold-500 bg-gold-500 text-white" : "border-white/70 bg-black/40 text-white"}`}>
                      {on ? "✓" : ""}
                    </span>
                    <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent px-2 pb-1.5 pt-6 text-[10.5px] text-white">
                      👁 {formatShort(v.views)} · ❤ {formatShort(v.likes)} · 💬 {formatShort(v.comments)}
                      {v.saves != null && ` · 🔖 ${formatShort(v.saves)}`}
                    </span>
                  </div>
                  <div className="space-y-1 p-2">
                    <div className="line-clamp-2 text-[11px] leading-snug text-ink-700">{(v.caption ?? "Sem legenda").split("\n")[0]}</div>
                    <div className="text-[10px] text-ink-400">
                      {origemDe(v)} · {v.posted_at ? new Date(v.posted_at).toLocaleDateString("pt-BR") : "—"}
                    </div>
                    {v.categories && v.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {v.categories.slice(0, 2).map((c) => (
                          <span key={c} className="rounded-full bg-gold-50 px-1.5 py-0.5 text-[9.5px] text-gold-700">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* 2. outras fontes */}
      <GlassCard strong className="space-y-3 p-5">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gold-600">2. Outras fontes (opcional)</h2>
          <p className="text-xs text-ink-500">Dá para gerar só com isto, sem escolher vídeo nenhum.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-ink-600">Assunto específico</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="ex.: por que agenda cheia não é agenda produtiva"
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-gold-400"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-ink-600">Trechos das aulas (Biblioteca)</span>
            <input
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              placeholder="ex.: Tempo Coringa, ser a sua palavra, resistência"
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-gold-400"
            />
          </label>
        </div>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-ink-600">Instruções extras</span>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            placeholder="ex.: tom mais provocativo, falar com donos de clínica, usar a analogia da canoa"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-gold-400"
          />
        </label>
      </GlassCard>

      {/* 3. gerar */}
      <GlassCard strong className="space-y-3 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gold-600">3. Gerar</h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            role="switch"
            aria-checked={scenes}
            onClick={() => setScenes((s) => !s)}
            className="flex items-center gap-3 text-sm text-ink-700"
            title="Manda ao Gemini a análise do Estúdio Reels para ele sugerir as telas de cada trecho"
          >
            <span className={`relative h-6 w-11 rounded-full transition ${scenes ? "bg-gold-500" : "bg-ink-200"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${scenes ? "left-[22px]" : "left-0.5"}`} />
            </span>
            <span>
              <strong>Gerar cenas</strong> do Estúdio Reels
            </span>
          </button>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => run("preview")} disabled={busy !== null || !podeGerar} className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm text-ink-700 hover:bg-ink-50 disabled:opacity-40">
              {busy === "preview" ? "Montando..." : "Ver o pedido"}
            </button>
            <button onClick={() => run("custom")} disabled={busy !== null || !podeGerar} className="btn-gold rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-50">
              {busy === "custom" ? "Gemini escrevendo..." : `✦ Gerar roteiro com ${selected.size || "nenhum"} vídeo${selected.size === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
        {busy && busy !== "preview" && <ProgressBar progress={0} indeterminate />}
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </GlassCard>

      {preview && (
        <GlassCard strong className="space-y-2 p-5">
          <div className="text-sm font-semibold text-ink-900">Pedido que vai para o Gemini · {preview.references} vídeos de referência</div>
          <pre className="scrollbar-thin max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-ink-50 p-4 font-mono text-xs leading-relaxed text-ink-600">{preview.prompt}</pre>
        </GlassCard>
      )}

      {script && (
        <GlassCard strong className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="gold">✦ gerado pelo Gemini</Badge>
            <h2 className="text-lg font-semibold text-ink-900">{script.title}</h2>
            {script.category && <Badge tone="neutral">{script.category}</Badge>}
          </div>
          <Block title="Gancho" text={script.hook} />
          <Block title="Estrutura" text={script.structure} />
          <Block title="Roteiro completo" text={script.full_script} />
          {script.scenes && <Block title="Cenas do Estúdio Reels" text={script.scenes} />}
          <div className="flex justify-end">
            <Link href="/roteiros#gerados" className="btn-gold rounded-lg px-4 py-2 text-sm font-semibold">
              Ver em Roteiros gerados
            </Link>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-xl border border-ink-100 bg-white/70 p-4">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gold-600">{title}</div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{text || "—"}</div>
    </section>
  );
}
