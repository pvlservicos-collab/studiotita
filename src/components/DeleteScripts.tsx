"use client";

import { useEffect, useState } from "react";
import { GlassCard, Badge, EmptyState } from "@/components/ui";
import type { ScriptRow } from "@/lib/types";

/** Aba "Excluir roteiros": marca vários e apaga de uma vez. */
export default function DeleteScripts() {
  const [scripts, setScripts] = useState<ScriptRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/scripts");
    const data = await res.json();
    setScripts(data.scripts ?? []);
    setSelected(new Set());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function removeSelected() {
    if (!confirm(`Excluir ${selected.size} roteiro(s)? Não dá para desfazer.`)) return;
    setDeleting(true);
    const res = await fetch("/api/scripts", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    const data = await res.json();
    setMessage(res.ok ? `${data.deleted} roteiro(s) excluído(s).` : data.error);
    setDeleting(false);
    load();
  }

  const allSelected = scripts.length > 0 && selected.size === scripts.length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
          Excluir <span className="gold-gradient-text">roteiros</span>
        </h1>
        <p className="mt-1 text-sm text-ink-500">Marque os roteiros que não servem mais e exclua de uma vez.</p>
      </div>

      {message && <GlassCard className="p-3 text-sm text-ink-700">{message}</GlassCard>}

      {loading ? (
        <div className="p-8 text-center text-sm text-ink-400">Carregando...</div>
      ) : scripts.length === 0 ? (
        <EmptyState title="Nenhum roteiro salvo" />
      ) : (
        <GlassCard strong className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-3">
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(scripts.map((s) => s.id)))}
                className="accent-gold-600"
              />
              Selecionar todos ({scripts.length})
            </label>
            <button
              onClick={removeSelected}
              disabled={!selected.size || deleting}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
            >
              {deleting ? "Excluindo..." : `Excluir selecionados (${selected.size})`}
            </button>
          </div>
          <ul className="divide-y divide-ink-50">
            {scripts.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-white/60">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="accent-gold-600" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink-800">{s.title}</div>
                    <div className="truncate text-xs text-ink-400">{s.full_script.slice(0, 120)}</div>
                  </div>
                  <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                    {s.category && <Badge tone="gold">{s.category}</Badge>}
                    <Badge tone="neutral">{s.source === "gemini" ? "Gemini" : s.source === "claude_code" ? "Claude" : "manual"}</Badge>
                    <span className="text-xs text-ink-400">{new Date(s.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </div>
  );
}
