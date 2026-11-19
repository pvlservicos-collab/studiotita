"use client";

import { useCallback, useEffect, useState } from "react";
import { GlassCard, EmptyState, ProgressBar } from "@/components/ui";
import BilboFace from "@/components/bilbo/BilboFace";

type Post = {
  id: string;
  caption: string | null;
  permalink: string | null;
  posted_at: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  thumb: string | null;
};
type Best = Post & { score: number | null; seen: boolean; saved_at: string | null; analysis_status: string | null; viral: boolean };
type Card = {
  competitor: { id: string; username: string; name: string | null; followers_count: number | null; media_count: number | null; biography: string | null; avatar_url: string | null };
  median_views: number | null;
  recent: Post[];
  best: Best[];
};
type Overview = { last_scan_at: string | null; viral_factor: number; unseen: number; cards: Card[] };
type Saved = Post & {
  video_id: string;
  username: string | null;
  score: number | null;
  saved_at: string;
  analysis_status: string | null;
  analysis_error: string | null;
  hook: string | null;
  structure: string | null;
};

type Tab = "virais" | "salvos";
const TABS: { id: Tab; label: string }[] = [
  { id: "virais", label: "Virais da semana" },
  { id: "salvos", label: "Roteiros salvos" },
];

const nf = (n: number | null | undefined) => (n == null ? "—" : new Intl.NumberFormat("pt-BR", { notation: n >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n));
const ago = (d: string | null) => {
  if (!d) return "";
  const h = Math.round((Date.now() - new Date(d).getTime()) / 3.6e6);
  return h < 24 ? `há ${h}h` : `há ${Math.round(h / 24)} dias`;
};

export default function BilboPage() {
  const [tab, setTab] = useState<Tab>("virais");
  const [data, setData] = useState<Overview | null>(null);
  const [saved, setSaved] = useState<Saved[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taking, setTaking] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/bilbo");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  const loadSaved = useCallback(async () => {
    const r = await fetch("/api/bilbo/roteiros");
    const d = await r.json();
    if (r.ok) setSaved(d.scripts);
  }, []);

  useEffect(() => {
    if (window.location.hash === "#salvos") setTab("salvos");
    load();
    loadSaved();
    // abriu a aba = viu o que o Bilbo achou (some a bolinha)
    fetch("/api/bilbo/unseen", { method: "POST" }).catch(() => {});
  }, [load, loadSaved]);

  // enquanto algum roteiro está sendo extraído, atualiza sozinho
  useEffect(() => {
    if (!saved?.some((s) => s.analysis_status === "pending" || s.analysis_status === "processing")) return;
    const t = setInterval(loadSaved, 8000);
    return () => clearInterval(t);
  }, [saved, loadSaved]);

  function select(t: Tab) {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  }

  async function scanNow() {
    setScanning(true);
    try {
      await fetch("/api/bilbo/scan", { method: "POST" });
      await load();
    } finally {
      setScanning(false);
    }
  }

  async function take(videoId: string) {
    setTaking((t) => ({ ...t, [videoId]: true }));
    try {
      const r = await fetch("/api/bilbo/roteiro", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ video_id: videoId }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await Promise.all([load(), loadSaved()]);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setTaking((t) => ({ ...t, [videoId]: false }));
    }
  }

  return (
    <div className="space-y-6">
      <GlassCard strong className="p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-gold-100 to-white text-4xl shadow-goldGlow ring-1 ring-gold-200"><BilboFace size={46} /></div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">Agente de concorrentes</div>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-900">Bilbo</h1>
              <p className="mt-1 max-w-xl text-sm text-ink-500">
                Vigia {data?.cards.length ?? "…"} concorrentes e separa os posts que mais performaram na semana — comparando as views de cada post com a mediana do
                próprio perfil. Você escolhe quais viram roteiro.
              </p>
            </div>
          </div>
          <div className="text-right">
            <button onClick={scanNow} disabled={scanning} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-ink-700 ring-1 ring-gold-200 hover:bg-gold-50 disabled:opacity-60">
              {scanning ? "Varrendo…" : "Varrer agora"}
            </button>
            <div className="mt-2 text-xs text-ink-400">{data?.last_scan_at ? `última varredura ${ago(data.last_scan_at)}` : "varre sozinho todo dia"}</div>
          </div>
        </div>
      </GlassCard>

      <div className="flex w-fit flex-wrap gap-1 rounded-full bg-white/60 p-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => select(t.id)} className={`rounded-full px-5 py-2 text-sm font-medium transition ${tab === t.id ? "btn-gold" : "text-ink-500 hover:bg-white hover:text-ink-800"}`}>
            {t.label}
            {t.id === "salvos" && saved && saved.length > 0 && <span className="ml-2 rounded-full bg-white/70 px-1.5 text-[11px]">{saved.length}</span>}
          </button>
        ))}
      </div>

      {error && <GlassCard className="p-4 text-sm text-rose-700">{error}</GlassCard>}
      {scanning && <ProgressBar progress={0} indeterminate />}

      {tab === "virais" &&
        (!data ? (
          <ProgressBar progress={0} indeterminate />
        ) : data.cards.length === 0 ? (
          <EmptyState title="O Bilbo não está vigiando ninguém" description="Peça ao Claude: bilbo_set_watchlist com all=true para vigiar todos os concorrentes de Concorrência." />
        ) : (
          <div className="space-y-6">
            {data.cards.map((c) => (
              <CompetitorCard key={c.competitor.id} card={c} viralFactor={data.viral_factor} taking={taking} onTake={take} />
            ))}
          </div>
        ))}

      {tab === "salvos" &&
        (!saved ? (
          <ProgressBar progress={0} indeterminate />
        ) : saved.length === 0 ? (
          <EmptyState title="Nenhum roteiro salvo ainda" description='Na aba "Virais da semana", clique em "Pegar roteiro" num post.' />
        ) : (
          <div className="space-y-5">
            {saved.map((s) => (
              <SavedRow key={s.video_id} s={s} retrying={!!taking[s.video_id]} onRetry={() => take(s.video_id)} />
            ))}
          </div>
        ))}
    </div>
  );
}

/** Card do concorrente: mockup do Instagram à esquerda, melhores da semana à direita. */
function CompetitorCard({ card, viralFactor, taking, onTake }: { card: Card; viralFactor: number; taking: Record<string, boolean>; onTake: (id: string) => void }) {
  const c = card.competitor;
  return (
    <GlassCard className="relative overflow-hidden p-0">
      {/* selo do Bilbo: este perfil está sendo vigiado */}
      <div
        title="Vigiado pelo Bilbo"
        className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-b from-gold-100 to-white text-2xl shadow-goldGlow ring-1 ring-gold-200"
      >
        <BilboFace size={30} />
      </div>
      <div className="grid lg:grid-cols-[380px_1fr]">
        {/* mockup do Instagram */}
        <div className="border-b border-gold-100 bg-gradient-to-b from-[#fbf7ee] to-white p-6 lg:border-b-0 lg:border-r">
          <div className="mx-auto max-w-[330px] rounded-[2.2rem] border-[6px] border-ink-900 bg-white p-3 shadow-[0_20px_50px_rgba(120,90,30,0.18)]">
            <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-ink-200" />
            <div className="flex items-center gap-3 px-1">
              <div className="rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 p-[2px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.avatar_url ? <img src={c.avatar_url} alt="" className="h-14 w-14 rounded-full border-2 border-white object-cover" /> : <div className="h-14 w-14 rounded-full border-2 border-white bg-ink-100" />}
              </div>
              <div className="grid flex-1 grid-cols-3 text-center">
                <div><div className="text-sm font-semibold text-ink-900">{nf(c.media_count)}</div><div className="text-[10px] text-ink-500">posts</div></div>
                <div><div className="text-sm font-semibold text-ink-900">{nf(c.followers_count)}</div><div className="text-[10px] text-ink-500">seguidores</div></div>
                <div><div className="text-sm font-semibold text-ink-900">{nf(card.median_views)}</div><div className="text-[10px] text-ink-500">views típicas</div></div>
              </div>
            </div>
            <div className="mt-2 px-1">
              <div className="text-[13px] font-semibold text-ink-900">{c.name}</div>
              <div className="text-[11px] text-ink-500">@{c.username}</div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-0.5 overflow-hidden rounded-lg">
              {card.recent.map((p) => (
                <a key={p.id} href={p.permalink ?? "#"} target="_blank" rel="noreferrer" className="relative block aspect-[3/4] bg-ink-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.thumb && <img src={p.thumb} alt="" className="h-full w-full object-cover" loading="lazy" />}
                  <span className="absolute bottom-1 left-1 text-[10px] font-semibold text-white drop-shadow">▶ {nf(p.views)}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* melhores da semana */}
        <div className="p-6">
          <div className="flex items-end justify-between pr-14">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-600">Melhores da semana</div>
              <h3 className="mt-1 text-lg font-semibold text-ink-900">@{c.username}</h3>
            </div>
            <span className="text-xs text-ink-400">score = views ÷ views típicas do perfil</span>
          </div>
          {card.best.length === 0 ? (
            <p className="mt-6 rounded-xl bg-ink-50 p-5 text-sm text-ink-500">Nenhum post desse perfil nos últimos 7 dias.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {card.best.map((p) => {
                const salvo = !!p.saved_at;
                const gerando = p.analysis_status === "pending" || p.analysis_status === "processing";
                return (
                  <div key={p.id} className={`flex gap-4 rounded-2xl border p-3 ${p.viral ? "border-gold-300 bg-gold-50/50" : "border-ink-100 bg-white/70"}`}>
                    <a href={p.permalink ?? "#"} target="_blank" rel="noreferrer" className="relative block h-36 w-24 shrink-0 overflow-hidden rounded-xl bg-ink-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.thumb && <img src={p.thumb} alt="" className="h-full w-full object-cover" loading="lazy" />}
                      {!p.seen && <span className="absolute left-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />}
                    </a>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex flex-wrap items-center gap-2">
                        {p.viral && <span className="rounded-md bg-gold-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">viralizou</span>}
                        <span className="text-sm font-semibold text-ink-900">{nf(p.views)} views</span>
                        {p.score != null && <span className="text-xs text-ink-500">{p.score.toFixed(1).replace(".", ",")}× o normal dele</span>}
                        <span className="text-xs text-ink-400">· {ago(p.posted_at)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-ink-600">{p.caption}</p>
                      <div className="mt-1 text-xs text-ink-400">{nf(p.likes)} curtidas · {nf(p.comments)} comentários</div>
                      <div className="mt-auto pt-2">
                        <button
                          onClick={() => onTake(p.id)}
                          disabled={(salvo && p.analysis_status !== "error") || taking[p.id]}
                          className={`rounded-full px-5 py-2 text-sm font-semibold transition ${salvo ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "btn-gold"} disabled:cursor-default`}
                        >
                          {taking[p.id] ? "Pegando…" : salvo ? (gerando ? "Extraindo roteiro…" : p.analysis_status === "error" ? "Tentar de novo" : "Roteiro salvo ✓") : "Pegar roteiro"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-4 text-[11px] text-ink-400">Viralizou = {viralFactor}× ou mais as views típicas do perfil.</p>
        </div>
      </div>
    </GlassCard>
  );
}

/** Roteiro salvo: o post de um lado, gancho e estrutura do outro. */
function friendlyError(e: string | null) {
  if (!e) return "erro desconhecido.";
  if (/prepayment credits are depleted|RESOURCE_EXHAUSTED|402/i.test(e)) return "os créditos da API do Gemini acabaram. Recarregue em aistudio.google.com (Billing) e clique em Tentar de novo.";
  if (/não libera o arquivo|música licenciada/i.test(e)) return "a Meta não liberou o arquivo deste vídeo (música licenciada).";
  return e.length > 300 ? e.slice(0, 300) + "…" : e;
}

function SavedRow({ s, retrying, onRetry }: { s: Saved; retrying: boolean; onRetry: () => void }) {
  const gerando = s.analysis_status === "pending" || s.analysis_status === "processing";
  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="grid md:grid-cols-[260px_1fr]">
        <div className="border-b border-gold-100 bg-gradient-to-b from-[#fbf7ee] to-white p-5 md:border-b-0 md:border-r">
          <a href={s.permalink ?? "#"} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl bg-ink-100 shadow-[0_12px_30px_rgba(120,90,30,0.18)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {s.thumb ? <img src={s.thumb} alt="" className="aspect-[9/16] w-full object-cover" /> : <div className="aspect-[9/16]" />}
          </a>
          <div className="mt-3 text-sm font-semibold text-ink-900">@{s.username}</div>
          <div className="text-xs text-ink-500">{nf(s.views)} views · {nf(s.likes)} curtidas{s.score != null ? ` · ${s.score.toFixed(1).replace(".", ",")}× o normal` : ""}</div>
          <p className="mt-2 line-clamp-3 text-xs text-ink-400">{s.caption}</p>
        </div>
        <div className="p-6">
          {gerando ? (
            <div className="py-10 text-center">
              <ProgressBar progress={0} indeterminate />
              <p className="mt-3 text-sm text-ink-500">O Gemini está lendo o vídeo frame a frame… (cerca de 1 minuto)</p>
            </div>
          ) : s.analysis_status === "error" ? (
            <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
              Não deu para extrair o roteiro: {friendlyError(s.analysis_error)}
              <div className="mt-3">
                <button onClick={onRetry} disabled={retrying} className="btn-gold rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60">
                  {retrying ? "Tentando…" : "Tentar de novo"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <section>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-600">Gancho</div>
                <div className="mt-2 whitespace-pre-wrap rounded-2xl bg-gold-50/60 p-4 text-sm leading-relaxed text-ink-800 ring-1 ring-gold-100">{s.hook || "—"}</div>
              </section>
              <section>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-600">Estrutura</div>
                <div className="mt-2 max-h-[520px] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm leading-relaxed text-ink-700 ring-1 ring-ink-100">{s.structure || "—"}</div>
              </section>
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
