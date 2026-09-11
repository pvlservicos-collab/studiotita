"use client";

import { useEffect, useState } from "react";
import { GlassCard, Badge, EmptyState } from "@/components/ui";
import VideoCard from "@/components/VideoCard";
import AnalysisModal from "@/components/AnalysisModal";
import type { ScriptRow, VideoRow } from "@/lib/types";

type CategoryVideo = { video: VideoRow; enabled: boolean };
type Category = { key: string; name: string; videos: CategoryVideo[]; enabled_count: number };

/**
 * Curadoria por categoria (categorias geradas pelo Gemini). Cada vídeo tem um
 * botão para sair da seleção; só os ligados entram em copiar, baixar e gerar.
 */
export default function CategoriesBoard({ onScriptCreated }: { onScriptCreated: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openVideo, setOpenVideo] = useState<VideoRow | null>(null);
  const [generateFor, setGenerateFor] = useState<Category | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar categorias.");
      setCategories(data.categories);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(category: Category, videoId: string, enabled: boolean) {
    // otimista: atualiza já e grava em seguida
    setCategories((prev) =>
      prev.map((c) =>
        c.key !== category.key
          ? c
          : {
              ...c,
              videos: c.videos.map((v) => (v.video.id === videoId ? { ...v, enabled } : v)),
              enabled_count: c.enabled_count + (enabled ? 1 : -1),
            }
      )
    );
    await fetch("/api/categories", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category: category.name, video_id: videoId, enabled }),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
          <span className="gold-gradient-text">Categorias</span>
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Curadoria dos vídeos pelos temas que o Gemini identificou. Desligue um vídeo para ele não entrar nos roteiros copiados,
          baixados ou enviados ao Gemini.
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-ink-400">Carregando categorias...</div>
      ) : error ? (
        <GlassCard className="p-5 text-sm text-rose-600">{error}</GlassCard>
      ) : categories.length === 0 ? (
        <EmptyState
          title="Nenhuma categoria ainda"
          description="As categorias aparecem quando os vídeos são analisados com o Gemini (o prompt pede as categorias de cada vídeo)."
        />
      ) : (
        categories.map((cat) => (
          <GlassCard key={cat.key} strong className="p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-ink-900">{cat.name}</h2>
                <p className="text-xs text-ink-500">
                  {cat.videos.length} vídeos · <strong>{cat.enabled_count}</strong> na seleção · categoria gerada pelo Gemini
                </p>
              </div>
              <CategoryActions category={cat} onGenerate={() => setGenerateFor(cat)} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {cat.videos.map(({ video, enabled }) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  dimmed={!enabled}
                  onOpen={() => setOpenVideo(video)}
                  extra={<SelectionToggle enabled={enabled} onChange={(v) => toggle(cat, video.id, v)} />}
                />
              ))}
            </div>
          </GlassCard>
        ))
      )}

      {openVideo && (
        <AnalysisModal video={openVideo} busy={false} onClose={() => setOpenVideo(null)} onRequested={load} onChanged={load} />
      )}
      {generateFor && (
        <GenerateDialog
          category={generateFor}
          onClose={() => setGenerateFor(null)}
          onCreated={() => {
            setGenerateFor(null);
            onScriptCreated();
          }}
        />
      )}
    </div>
  );
}

function SelectionToggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className="flex w-full items-center justify-between gap-2 text-[11px] font-medium text-ink-600"
      title={enabled ? "Clique para tirar este vídeo da seleção" : "Clique para voltar este vídeo à seleção"}
    >
      <span>{enabled ? "Na seleção" : "Fora da seleção"}</span>
      <span className={`relative h-5 w-9 rounded-full transition ${enabled ? "bg-gold-500" : "bg-ink-200"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${enabled ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function CategoryActions({ category, onGenerate }: { category: Category; onGenerate: () => void }) {
  const [busy, setBusy] = useState<"copy" | "download" | null>(null);
  const [copied, setCopied] = useState(false);

  async function compiled() {
    const res = await fetch(`/api/categories?compile=${encodeURIComponent(category.name)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.markdown as string;
  }

  async function copy() {
    setBusy("copy");
    try {
      await navigator.clipboard.writeText(await compiled());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    setBusy("download");
    try {
      const url = URL.createObjectURL(new Blob([await compiled()], { type: "text/markdown;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `roteiros-${category.key.replace(/\s+/g, "-")}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const none = category.enabled_count === 0;
  const btn = "rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-40";
  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={copy} disabled={none || busy !== null} className={btn}>
        {copied ? "Copiado ✓" : busy === "copy" ? "Copiando..." : "Copiar roteiros da categoria"}
      </button>
      <button onClick={download} disabled={none || busy !== null} className={btn}>
        {busy === "download" ? "Baixando..." : "Baixar roteiros da categoria"}
      </button>
      <button onClick={onGenerate} disabled={none} className="btn-gold rounded-lg px-3 py-2 text-xs font-semibold">
        ✦ Pedir ao Gemini um novo roteiro
      </button>
    </div>
  );
}

function GenerateDialog({ category, onClose, onCreated }: { category: Category; onClose: () => void; onCreated: () => void }) {
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [script, setScript] = useState<ScriptRow | null>(null);

  useEffect(() => {
    fetch(`/api/categories?instructions=${encodeURIComponent(category.name)}`)
      .then((r) => r.json())
      .then((d) => setInstructions(d.instructions ?? ""))
      .finally(() => setLoading(false));
  }, [category.name]);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/categories/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category: category.name, instructions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar roteiro.");
      setScript(data.script);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-3 backdrop-blur-sm sm:p-8" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl border border-gold-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-ink-100 p-5">
          <div>
            <h2 className="text-base font-semibold text-ink-900">Novo roteiro da categoria “{category.name}”</h2>
            <p className="text-xs text-ink-500">
              Pedido de texto ao Gemini com as instruções abaixo + os roteiros dos {category.enabled_count} vídeos na seleção.
            </p>
          </div>
          <button onClick={onClose} className="px-2 text-lg leading-none text-ink-400 hover:text-ink-700" aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="space-y-3 p-5">
          {script ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="gold">✦ gerado pelo Gemini</Badge>
                <span className="text-sm font-semibold text-ink-900">{script.title}</span>
                <span className="text-xs text-ink-400">salvo em Roteiros</span>
              </div>
              <Block title="Gancho" text={script.hook} />
              <Block title="Estrutura" text={script.structure} />
              <Block title="Roteiro completo" text={script.full_script} />
              <div className="flex justify-end">
                <button onClick={onCreated} className="btn-gold rounded-lg px-4 py-2 text-sm font-semibold">
                  Ver em Roteiros
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-ink-500">
                As instruções já trazem o método e a estrutura do Augusto que estão na Biblioteca. Ajuste o que quiser antes de enviar.
              </p>
              <textarea
                value={loading ? "Carregando instruções..." : instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={16}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-ink-700 outline-none focus:border-gold-400"
              />
              {error && <p className="text-xs text-rose-600">{error}</p>}
              <div className="flex justify-end">
                <button onClick={send} disabled={sending || loading} className="btn-gold rounded-lg px-4 py-2 text-sm font-semibold">
                  {sending ? "Gemini escrevendo o roteiro..." : "Enviar ao Gemini"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
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
