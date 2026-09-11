"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard, Badge, ProgressBar } from "@/components/ui";
import { PERIODS, RANK_METRICS, type PeriodId, type RankMetric } from "@/lib/periods";
import type { ScriptRow } from "@/lib/types";

type Options = {
  own_categories: { name: string; videos: number }[];
  competitor_categories: { name: string; videos: number }[];
  competitors: { id: string; username: string; videos: number }[];
};

type RowId = "best" | "search" | "categories" | "competitors" | "subject" | "library";

const selectCls = "rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 outline-none";

/** Tela "Criar roteiro": aleatório num clique, ou montando as fontes linha a linha. */
export default function ScriptCreator() {
  const [options, setOptions] = useState<Options | null>(null);
  const [on, setOn] = useState<Record<RowId, boolean>>({ best: false, search: false, categories: false, competitors: false, subject: false, library: false });
  const [videoSearch, setVideoSearch] = useState("");
  const [searchMetric, setSearchMetric] = useState<RankMetric>("views");
  const [period, setPeriod] = useState<PeriodId>("30d");
  const [metric, setMetric] = useState<RankMetric>("views");
  const [top, setTop] = useState(5);
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [competitorCats, setCompetitorCats] = useState<Set<string>>(new Set());
  const [competitorIds, setCompetitorIds] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [instructions, setInstructions] = useState("");
  const [scenes, setScenes] = useState(true);
  const [busy, setBusy] = useState<"random" | "custom" | "preview" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [script, setScript] = useState<ScriptRow | null>(null);
  const [preview, setPreview] = useState<{ prompt: string; references: number } | null>(null);

  useEffect(() => {
    fetch("/api/generate-script")
      .then((r) => r.json())
      .then(setOptions);
  }, []);

  const toggleSet = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  function body(random: boolean) {
    if (random) return { random: true, scenes, instructions: instructions || null };
    return {
      best: on.best ? { period, metric, top } : null,
      videoSearch: on.search && videoSearch.trim() ? { term: videoSearch.trim(), metric: searchMetric, top: 5 } : null,
      categories: [...(on.categories ? Array.from(categories) : []), ...(on.competitors ? Array.from(competitorCats) : [])],
      competitorIds: on.competitors ? Array.from(competitorIds) : [],
      subject: on.subject ? subject : null,
      librarySearch: on.library ? librarySearch : null,
      instructions: instructions || null,
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

  const anySelected = Object.values(on).some(Boolean) || instructions.trim().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
          Criar <span className="gold-gradient-text">roteiro</span>
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          O Gemini escreve um roteiro novo no método e na estrutura do Augusto (arquivos da Biblioteca), usando as referências que você escolher.
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

      <GlassCard strong className="space-y-1 p-2">
        <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Ou monte a sua geração: marque as linhas que quer usar</div>

        <Row id="best" on={on} setOn={setOn} title="Melhores vídeos" description="Seus posts com melhor desempenho no período, com o que o Gemini extraiu de cada um.">
          <div className="flex flex-wrap gap-2">
            <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodId)} className={selectCls}>
              {PERIODS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <select value={metric} onChange={(e) => setMetric(e.target.value as RankMetric)} className={selectCls}>
              {RANK_METRICS.map((m) => (
                <option key={m.id} value={m.id}>por {m.label}</option>
              ))}
            </select>
            <select value={top} onChange={(e) => setTop(Number(e.target.value))} className={selectCls}>
              {[3, 5, 10].map((n) => (
                <option key={n} value={n}>Top {n}</option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-[11px] text-ink-400">Entram só os vídeos que já têm análise do Gemini.</p>
        </Row>

        <Row
          id="search"
          on={on}
          setOn={setOn}
          title="Vídeos que falam sobre uma palavra"
          description="Procura a palavra na legenda, na transcrição e nas categorias (seus vídeos e dos concorrentes) e usa os melhores."
        >
          <div className="flex flex-wrap gap-2">
            <input
              value={videoSearch}
              onChange={(e) => setVideoSearch(e.target.value)}
              placeholder="ex.: procrastinação, agenda, sono"
              className="min-w-[220px] flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-gold-400"
            />
            <select value={searchMetric} onChange={(e) => setSearchMetric(e.target.value as RankMetric)} className={selectCls}>
              {RANK_METRICS.map((m) => (
                <option key={m.id} value={m.id}>os 5 com mais {m.label.toLowerCase()}</option>
              ))}
            </select>
          </div>
        </Row>

        <Row id="categories" on={on} setOn={setOn} title="Categorias" description="Os vídeos ligados das categorias escolhidas (aba Roteiros › Categorias).">
          <Chips
            items={options?.own_categories.map((c) => ({ id: c.name, label: `${c.name} · ${c.videos}` })) ?? []}
            selected={categories}
            onToggle={(v) => toggleSet(categories, v, setCategories)}
            empty="Nenhuma categoria ainda: analise vídeos com o Gemini."
          />
        </Row>

        <Row id="competitors" on={on} setOn={setOn} title="Concorrentes" description="Categorias dos concorrentes e/ou os vídeos mais vistos (já analisados) de cada um.">
          <div className="space-y-2">
            <Chips
              items={options?.competitor_categories.map((c) => ({ id: c.name, label: `${c.name} · ${c.videos}` })) ?? []}
              selected={competitorCats}
              onToggle={(v) => toggleSet(competitorCats, v, setCompetitorCats)}
              empty="Nenhuma categoria de concorrente ainda: gere os relatórios na página do concorrente."
            />
            <Chips
              items={options?.competitors.map((c) => ({ id: c.id, label: `@${c.username} · top vídeos` })) ?? []}
              selected={competitorIds}
              onToggle={(v) => toggleSet(competitorIds, v, setCompetitorIds)}
              empty="Nenhum concorrente cadastrado."
            />
          </div>
        </Row>

        <Row id="subject" on={on} setOn={setOn} title="Assunto específico" description="Um tema que você quer abordar.">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="ex.: por que agenda cheia não é agenda produtiva"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-gold-400"
          />
        </Row>

        <Row id="library" on={on} setOn={setOn} title="Trechos das aulas" description="Busca passagens da Base de Ensino na Biblioteca para o roteiro usar as ideias reais do Augusto.">
          <input
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            placeholder="ex.: Tempo Coringa, ser a sua palavra, resistência"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-gold-400"
          />
        </Row>
      </GlassCard>

      <GlassCard strong className="space-y-3 p-5">
        <label className="block text-sm font-semibold text-ink-900">Instruções extras (opcional)</label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          placeholder="ex.: tom mais provocativo, falar com donos de clínica, usar a analogia da canoa"
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-gold-400"
        />
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
            <button onClick={() => run("preview")} disabled={busy !== null || !anySelected} className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm text-ink-700 hover:bg-ink-50 disabled:opacity-40">
              {busy === "preview" ? "Montando..." : "Ver o pedido"}
            </button>
            <button onClick={() => run("custom")} disabled={busy !== null || !anySelected} className="btn-gold rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-50">
              {busy === "custom" ? "Gemini escrevendo..." : "✦ Gerar roteiro com o Gemini"}
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

function Row({
  id,
  on,
  setOn,
  title,
  description,
  children,
}: {
  id: RowId;
  on: Record<RowId, boolean>;
  setOn: (fn: (prev: Record<RowId, boolean>) => Record<RowId, boolean>) => void;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const active = on[id];
  return (
    <div className={`rounded-xl transition ${active ? "bg-gold-50/60" : "hover:bg-white/60"}`}>
      <button onClick={() => setOn((p) => ({ ...p, [id]: !p[id] }))} className="flex w-full items-start gap-3 px-3 py-3 text-left">
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${
            active ? "border-gold-500 bg-gold-500 text-white" : "border-ink-300 bg-white"
          }`}
        >
          {active ? "✓" : ""}
        </span>
        <span>
          <span className="block text-sm font-semibold text-ink-900">{title}</span>
          <span className="block text-xs text-ink-500">{description}</span>
        </span>
      </button>
      {active && <div className="px-11 pb-4">{children}</div>}
    </div>
  );
}

function Chips({
  items,
  selected,
  onToggle,
  empty,
}: {
  items: { id: string; label: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  empty: string;
}) {
  if (!items.length) return <p className="text-xs text-ink-400">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onToggle(it.id)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            selected.has(it.id) ? "btn-gold" : "border border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
          }`}
        >
          {it.label}
        </button>
      ))}
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
