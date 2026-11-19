"use client";

import { useEffect, useState } from "react";
import { GlassCard, EmptyState, ProgressBar } from "@/components/ui";

/** Botão "Melhores" do Bilbo: o ranking POR PERFIL de todos os concorrentes (o mesmo que o conector manda). */

type Post = {
  posicao: number;
  video_id: string;
  instagram: string | null;
  publicado_em: string | null;
  legenda: string | null;
  capa: string | null;
  metricas: {
    views: number | null;
    curtidas: number | string | null;
    comentarios: number | null;
    engajamento_pct: number | null;
    vezes_o_normal: number | null;
    viralizou: boolean;
  };
  roteiro_do_original: string;
};
type Perfil = { perfil: string; nome: string | null; seguidores: number | null; views_tipicas_do_perfil: number | null; posts: Post[] };
type Melhores = { periodo: string; perfis: Perfil[]; sem_posts_no_periodo?: string[]; aviso_dados_antigos?: string };
type Roteiro = { titulo: string; gancho: string; roteiro_completo: string };
type Geracao = { estado: "gerando" | "extraindo" | "pronto" | "erro"; roteiro?: Roteiro; erro?: string };

const nf = (n: number | null | undefined) => (n == null ? "—" : new Intl.NumberFormat("pt-BR", { notation: n >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n));
const x = (n: number | null) => (n == null ? null : `${n.toFixed(1).replace(".", ",")}×`);
const ago = (d: string | null) => {
  if (!d) return "";
  const h = Math.round((Date.now() - new Date(d).getTime()) / 3.6e6);
  return h < 24 ? `há ${h}h` : `há ${Math.round(h / 24)} dias`;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function MelhoresView() {
  const [dias, setDias] = useState(7);
  const [data, setData] = useState<Melhores | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gen, setGen] = useState<Record<string, Geracao>>({});

  useEffect(() => {
    setData(null);
    setError(null);
    fetch(`/api/bilbo/melhores?days=${dias}&por_perfil=3`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError((e as Error).message));
  }, [dias]);

  async function gerar(videoId: string) {
    setGen((g) => ({ ...g, [videoId]: { estado: "gerando" } }));
    try {
      // se o original ainda está sendo lido pelo Gemini, tenta de novo algumas vezes
      for (let tentativa = 0; tentativa < 6; tentativa++) {
        const r = await fetch("/api/bilbo/roteiro-novo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ video_id: videoId }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (d.status === "pronto") {
          setGen((g) => ({ ...g, [videoId]: { estado: "pronto", roteiro: d.roteiro_novo } }));
          return;
        }
        setGen((g) => ({ ...g, [videoId]: { estado: "extraindo" } }));
        await sleep(20000);
      }
      throw new Error("O Gemini está demorando para ler o vídeo. Tente de novo em alguns minutos.");
    } catch (e) {
      setGen((g) => ({ ...g, [videoId]: { estado: "erro", erro: (e as Error).message } }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-500">
          Ranking <b>por perfil</b>: em cada concorrente, os posts do período com mais views. O “× o normal” compara com as views típicas do próprio perfil.
        </p>
        <div className="flex gap-1 rounded-full bg-white/60 p-1">
          {[7, 14, 30].map((d) => (
            <button key={d} onClick={() => setDias(d)} className={`rounded-full px-4 py-1.5 text-xs font-medium ${dias === d ? "btn-gold" : "text-ink-500 hover:bg-white"}`}>
              {d === 7 ? "Semana" : `${d} dias`}
            </button>
          ))}
        </div>
      </div>

      {error && <GlassCard className="p-4 text-sm text-rose-700">{error}</GlassCard>}
      {!data && !error && <ProgressBar progress={0} indeterminate />}
      {data && data.perfis.length === 0 && <EmptyState title="Nenhum post no período" description="Clique em Varrer agora para atualizar os concorrentes." />}

      {data?.perfis.map((p) => (
        <GlassCard key={p.perfil} className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-ink-900">{p.perfil}</h3>
              <div className="text-xs text-ink-500">
                {p.nome ? `${p.nome} · ` : ""}
                {nf(p.seguidores)} seguidores · {nf(p.views_tipicas_do_perfil)} views típicas
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {p.posts.map((post) => {
              const g = gen[post.video_id];
              const m = post.metricas;
              return (
                <div key={post.video_id} className={`flex flex-col rounded-2xl border p-3 ${m.viralizou ? "border-gold-300 bg-gold-50/50" : "border-ink-100 bg-white/70"}`}>
                  <div className="flex gap-3">
                    <a href={post.instagram ?? "#"} target="_blank" rel="noreferrer" className="relative block h-32 w-20 shrink-0 overflow-hidden rounded-xl bg-ink-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {post.capa && <img src={post.capa} alt="" className="h-full w-full object-cover" loading="lazy" />}
                      <span className="absolute left-1.5 top-1.5 rounded-md bg-ink-900/80 px-1.5 text-[11px] font-bold text-white">{post.posicao}º</span>
                    </a>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {m.viralizou && <span className="rounded-md bg-gold-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">viralizou</span>}
                        <span className="text-sm font-semibold text-ink-900">{nf(m.views)} views</span>
                      </div>
                      {x(m.vezes_o_normal) && <div className="text-xs text-ink-500">{x(m.vezes_o_normal)} o normal dele · {ago(post.publicado_em)}</div>}
                      <div className="mt-1 text-xs text-ink-400">
                        {typeof m.curtidas === "number" ? `${nf(m.curtidas)} curtidas` : "curtidas ocultas"} · {nf(m.comentarios)} coment.
                        {m.engajamento_pct != null ? ` · ${String(m.engajamento_pct).replace(".", ",")}% eng.` : ""}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-ink-600">{post.legenda}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {post.instagram && (
                      <a href={post.instagram} target="_blank" rel="noreferrer" className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-ink-700 ring-1 ring-gold-200 hover:bg-gold-50">
                        Ver no Instagram
                      </a>
                    )}
                    <button
                      onClick={() => gerar(post.video_id)}
                      disabled={g?.estado === "gerando" || g?.estado === "extraindo"}
                      className="btn-gold rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-60"
                    >
                      {g?.estado === "gerando" ? "Gerando…" : g?.estado === "extraindo" ? "Lendo o vídeo…" : g?.estado === "pronto" ? "Gerar outro" : "Gerar roteiro"}
                    </button>
                  </div>
                  {(g?.estado === "gerando" || g?.estado === "extraindo") && (
                    <div className="mt-3">
                      <ProgressBar progress={0} indeterminate />
                      <p className="mt-1 text-[11px] text-ink-400">Leva de 1 a 3 minutos: o Gemini lê o original e escreve o roteiro do Augusto.</p>
                    </div>
                  )}
                  {g?.estado === "erro" && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{g.erro}</p>}
                  {g?.estado === "pronto" && g.roteiro && (
                    <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-gold-100">
                      <div className="text-xs font-semibold text-ink-900">{g.roteiro.titulo}</div>
                      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-gold-600">Gancho</div>
                      <p className="whitespace-pre-wrap text-xs text-ink-700">{g.roteiro.gancho}</p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-gold-700">Roteiro completo</summary>
                        <p className="mt-1 max-h-80 overflow-y-auto whitespace-pre-wrap text-xs text-ink-700">{g.roteiro.roteiro_completo}</p>
                      </details>
                      <a href="/roteiros" className="mt-2 inline-block text-xs font-semibold text-gold-700 underline">Abrir em Roteiros</a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      ))}

      {data?.sem_posts_no_periodo && data.sem_posts_no_periodo.length > 0 && (
        <p className="text-xs text-ink-400">Sem posts no período: {data.sem_posts_no_periodo.join(", ")}.</p>
      )}
    </div>
  );
}
