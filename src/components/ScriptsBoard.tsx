"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard, Badge, EmptyState } from "@/components/ui";
import { formatShort } from "@/lib/metricLabels";
import type { ScriptRow } from "@/lib/types";

/** Aba "Roteiros gerados": criados pelo gerador, pelo Claude ou à mão. */
export default function ScriptsBoard() {
  const [scripts, setScripts] = useState<ScriptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scripts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar roteiros.");
      setScripts(data.scripts);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
            Roteiros <span className="gold-gradient-text">gerados</span>
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Criados pelo gerador (Gemini), pelo Claude do Augusto ou à mão. A pontuação vem dos números dos vídeos de referência, ou do
            vídeo publicado quando o roteiro está ligado a um.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowForm((v) => !v)} className="rounded-xl border border-ink-200 bg-white/70 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-white">
            {showForm ? "Cancelar" : "+ Escrever à mão"}
          </button>
          <Link href="/criar-roteiro" className="btn-gold rounded-xl px-4 py-2 text-sm font-semibold">
            ✦ Criar roteiro
          </Link>
        </div>
      </div>

      {showForm && (
        <ScriptForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-ink-400">Carregando roteiros...</div>
      ) : error ? (
        <div className="p-8 text-center text-sm text-rose-600">{error}</div>
      ) : scripts.length === 0 ? (
        <EmptyState title="Nenhum roteiro gerado ainda" description="Use o botão Criar roteiro, a aba Categorias ou peça ao Claude do Augusto." />
      ) : (
        <div className="space-y-5">
          {scripts.map((script) => (
            <ScriptCard key={script.id} script={script} onDeleted={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: NonNullable<ScriptRow["score"]> }) {
  const tone = score.score >= 70 ? "bg-emerald-100 text-emerald-800" : score.score >= 40 ? "bg-gold-100 text-gold-800" : "bg-ink-100 text-ink-600";
  const detail =
    score.basis === "resultado"
      ? `Resultado do vídeo publicado: ${formatShort(score.avg_views)} views, ${formatShort(score.avg_comments)} comentários`
      : `Média dos ${score.videos} vídeos de referência: ${formatShort(score.avg_views)} views, ${formatShort(score.avg_comments)} comentários, ${formatShort(score.avg_saves)} salvamentos`;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`} title={`${detail}. Nota 0-100 comparando cada vídeo com os da mesma conta (60% views, 40% engajamento).`}>
      ★ {score.score} {score.basis === "resultado" ? "· resultado" : "· referências"}
    </span>
  );
}

function ScriptCard({ script, onDeleted }: { script: ScriptRow; onDeleted: () => void }) {
  async function remove() {
    if (!confirm(`Excluir o roteiro "${script.title}"? Não dá para desfazer.`)) return;
    const res = await fetch(`/api/scripts/${script.id}`, { method: "DELETE" });
    if (res.ok) onDeleted();
  }
  const thumbs = script.thumbs ?? [];

  return (
    <GlassCard strong className="flex gap-4 p-5">
      {/* thumbs dos vídeos que originaram o roteiro (ou do vídeo publicado) */}
      <div className="flex w-20 shrink-0 flex-col gap-1.5 sm:w-24">
        {thumbs.length ? (
          thumbs.map((t, i) => (
            <a
              key={i}
              href={t.permalink ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              title={t.caption ?? ""}
              className={`block overflow-hidden rounded-lg bg-ink-100 ${i === 0 ? "aspect-[9/16]" : "aspect-square opacity-80 hover:opacity-100"}`}
            >
              {t.thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.thumbnail_url} alt="" className="h-full w-full object-cover" />
              )}
            </a>
          ))
        ) : (
          <div className="flex aspect-[9/16] items-center justify-center rounded-lg border border-dashed border-ink-200 text-center text-[10px] text-ink-400">
            sem vídeo
          </div>
        )}
        {script.source_video_ids && script.source_video_ids.length > thumbs.length && (
          <span className="text-center text-[10px] text-ink-400">+{script.source_video_ids.length - thumbs.length} refs</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-ink-900">{script.title}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {script.score && <ScoreBadge score={script.score} />}
            {script.category && <Badge tone="gold">{script.category}</Badge>}
            <Badge tone={script.source === "manual" ? "neutral" : "gold"}>
              {script.source === "gemini" ? "✦ gerado pelo Gemini" : script.source === "claude_code" ? "via Claude" : "manual"}
            </Badge>
            <button onClick={remove} className="rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">
              Excluir
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-ink-100 bg-white/60 p-4 lg:col-span-2 lg:row-span-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-600">Roteiro</div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{script.full_script || "—"}</p>
          </div>
          <div className="rounded-xl border border-ink-100 bg-white/60 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-600">Gancho (0–3s)</div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{script.hook || "—"}</p>
          </div>
          <div className="rounded-xl border border-ink-100 bg-white/60 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-600">Estrutura</div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{script.structure || "—"}</p>
          </div>
        </div>

        {script.scenes && (
          <div className="mt-3 rounded-xl border border-ink-800 bg-ink-900 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-300">Cenas do Estúdio Reels (Gemini)</div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-100">{script.scenes}</p>
          </div>
        )}

        {script.generation_prompt && (
          <details className="mt-3 rounded-xl border border-ink-100 bg-ink-50/60 p-3">
            <summary className="cursor-pointer select-none text-sm font-medium text-ink-700">Pedido enviado ao Gemini para gerar este roteiro</summary>
            <pre className="scrollbar-thin mt-3 max-h-80 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-ink-600">{script.generation_prompt}</pre>
          </details>
        )}
      </div>
    </GlassCard>
  );
}

function ScriptForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [fullScript, setFullScript] = useState("");
  const [hook, setHook] = useState("");
  const [structure, setStructure] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/scripts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, full_script: fullScript, hook, structure }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar roteiro.");
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard className="p-5">
      <input
        className="mb-3 w-full rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-gold-400"
        placeholder="Título do roteiro"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:grid-rows-2">
        <textarea
          className="min-h-[160px] rounded-lg border border-ink-200 bg-white/70 p-3 text-sm outline-none focus:border-gold-400 md:col-span-2 md:row-span-2"
          placeholder="Roteiro completo, por extenso..."
          value={fullScript}
          onChange={(e) => setFullScript(e.target.value)}
        />
        <textarea
          className="min-h-[75px] rounded-lg border border-ink-200 bg-white/70 p-3 text-sm outline-none focus:border-gold-400"
          placeholder="Gancho — primeiros 3 segundos"
          value={hook}
          onChange={(e) => setHook(e.target.value)}
        />
        <textarea
          className="min-h-[75px] rounded-lg border border-ink-200 bg-white/70 p-3 text-sm outline-none focus:border-gold-400"
          placeholder="Estrutura do roteiro"
          value={structure}
          onChange={(e) => setStructure(e.target.value)}
        />
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <div className="mt-3 flex justify-end">
        <button onClick={save} disabled={saving || !fullScript.trim()} className="btn-gold rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60">
          {saving ? "Salvando..." : "Salvar roteiro"}
        </button>
      </div>
    </GlassCard>
  );
}
