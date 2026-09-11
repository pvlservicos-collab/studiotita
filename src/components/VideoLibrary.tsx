"use client";

import { useMemo, useState } from "react";
import { GlassCard } from "@/components/ui";
import VideoBrowser from "@/components/VideoBrowser";

/** Aba Posts: os reels do Augusto, com sincronização e cadastro manual. */
export default function VideoLibrary() {
  const [syncing, setSyncing] = useState(false);
  const [syncLimit, setSyncLimit] = useState(50);
  const [showAddForm, setShowAddForm] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  async function syncMeta() {
    setSyncing(true);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sync_meta", limit: syncLimit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao sincronizar com a Meta.");
      setReloadToken((t) => t + 1);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
          Seus <span className="gold-gradient-text">posts</span>
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Reels do Instagram com as métricas da Meta. Resumo, transcrição, gancho, estrutura e categorias são gerados pelo Gemini.
        </p>
      </div>

      {showAddForm && (
        <AddVideoForm
          onCreated={() => {
            setShowAddForm(false);
            setReloadToken((t) => t + 1);
          }}
        />
      )}

      <VideoBrowser
        scopeQuery="scope=own"
        reloadToken={reloadToken}
        emptyDescription="Sincronize com a Meta ou adicione um vídeo manualmente para começar."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="rounded-xl border border-ink-200 bg-white/70 px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-white"
            >
              + Adicionar manualmente
            </button>
            <div className="flex items-center overflow-hidden rounded-xl">
              <select
                value={syncLimit}
                onChange={(e) => setSyncLimit(Number(e.target.value))}
                className="h-full border border-r-0 border-gold-300 bg-white/80 px-2 py-2 text-sm text-ink-700 outline-none"
                title="Quantos posts recentes buscar (semestre ≈ 200+)"
              >
                {[25, 50, 100, 200, 400].map((n) => (
                  <option key={n} value={n}>
                    {n} posts
                  </option>
                ))}
              </select>
              <button onClick={syncMeta} disabled={syncing} className="btn-gold px-4 py-2 text-sm font-semibold disabled:opacity-60">
                {syncing ? "Sincronizando..." : "Sincronizar com a Meta"}
              </button>
            </div>
          </div>
        }
      />
    </div>
  );
}

function AddVideoForm({ onCreated }: { onCreated: () => void }) {
  const [caption, setCaption] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => videoUrl.trim().length > 0, [videoUrl]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caption, video_url: videoUrl, thumbnail_url: thumbnailUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar vídeo.");
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard className="p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          className="rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-gold-400 sm:col-span-3"
          placeholder="Legenda (opcional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <input
          className="rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-gold-400 sm:col-span-2"
          placeholder="URL do vídeo (obrigatório para analisar com o Gemini)"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
        <input
          className="rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-gold-400"
          placeholder="URL da capa (opcional)"
          value={thumbnailUrl}
          onChange={(e) => setThumbnailUrl(e.target.value)}
        />
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <div className="mt-3 flex justify-end">
        <button onClick={save} disabled={!canSave || saving} className="btn-gold rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60">
          {saving ? "Salvando..." : "Salvar vídeo"}
        </button>
      </div>
    </GlassCard>
  );
}
