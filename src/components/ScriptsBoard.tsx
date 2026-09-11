"use client";

import { useEffect, useState } from "react";
import { GlassCard, Badge, EmptyState } from "@/components/ui";
import type { ScriptRow } from "@/lib/types";

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
            Seus <span className="gold-gradient-text">roteiros</span>
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Roteiro completo, gancho (3 primeiros segundos) e estrutura. Criados à mão, pelo Claude do Augusto ou gerados pelo
            Gemini a partir de uma categoria.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-gold rounded-xl px-4 py-2 text-sm font-semibold"
        >
          {showForm ? "Cancelar" : "+ Novo roteiro"}
        </button>
      </div>

      {showForm && <ScriptForm onCreated={() => { setShowForm(false); load(); }} />}

      {loading ? (
        <div className="p-8 text-center text-sm text-ink-400">Carregando roteiros...</div>
      ) : error ? (
        <div className="p-8 text-center text-sm text-rose-600">{error}</div>
      ) : scripts.length === 0 ? (
        <EmptyState
          title="Nenhum roteiro salvo ainda"
          description="Crie um roteiro manualmente ou peça para o Claude Code do cliente salvar um via MCP (save_script)."
        />
      ) : (
        <div className="space-y-6">
          {scripts.map((script) => (
            <ScriptCard key={script.id} script={script} onDeleted={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScriptCard({ script, onDeleted }: { script: ScriptRow; onDeleted: () => void }) {
  async function remove() {
    if (!confirm(`Excluir o roteiro "${script.title}"? Não dá para desfazer.`)) return;
    const res = await fetch(`/api/scripts/${script.id}`, { method: "DELETE" });
    if (res.ok) onDeleted();
  }

  return (
    <GlassCard strong className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-ink-900">{script.title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {script.category && <Badge tone="gold">{script.category}</Badge>}
          <Badge tone={script.source === "manual" ? "neutral" : "gold"}>
            {script.source === "gemini" ? "✦ gerado pelo Gemini" : script.source === "claude_code" ? "via Claude" : "manual"}
          </Badge>
          <Badge
            tone={
              script.status === "published" ? "success" : script.status === "ready" ? "gold" : "neutral"
            }
          >
            {script.status}
          </Badge>
          <button onClick={remove} className="rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">
            Excluir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:grid-rows-2">
        <div className="rounded-xl border border-ink-100 bg-white/60 p-4 md:col-span-2 md:row-span-2">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-600">Roteiro</div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
            {script.full_script || "—"}
          </p>
        </div>

        <div className="rounded-xl border border-ink-100 bg-white/60 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-600">
            Gancho (0–3s)
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{script.hook || "—"}</p>
        </div>

        <div className="rounded-xl border border-ink-100 bg-white/60 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-600">Estrutura</div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{script.structure || "—"}</p>
        </div>
      </div>

      {script.generation_prompt && (
        <details className="mt-3 rounded-xl border border-ink-100 bg-ink-50/60 p-3">
          <summary className="cursor-pointer select-none text-sm font-medium text-ink-700">
            Pedido enviado ao Gemini para gerar este roteiro
          </summary>
          <pre className="scrollbar-thin mt-3 max-h-80 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-ink-600">
            {script.generation_prompt}
          </pre>
        </details>
      )}

      {script.latest_analysis_summary && (
        <div className="mt-3 rounded-xl border border-gold-200 bg-gold-50/40 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-600">
            Análise do Gemini
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
            {script.latest_analysis_summary}
          </p>
        </div>
      )}
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
        <button
          onClick={save}
          disabled={saving || !fullScript.trim()}
          className="btn-gold rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar roteiro"}
        </button>
      </div>
    </GlassCard>
  );
}
