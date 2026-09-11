"use client";

import { useEffect, useState } from "react";
import { Badge, ProgressBar } from "@/components/ui";
import { VIDEO_METRICS, formatMetric } from "@/lib/metricLabels";
import type { AnalysisRow, VideoRow } from "@/lib/types";

type Mode = "view" | "new";

function formatDateTime(d: string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(d));
}

export default function AnalysisModal({
  video,
  busy,
  onClose,
  onRequested,
  onChanged,
}: {
  video: VideoRow;
  busy: boolean;
  onClose: () => void;
  onRequested: () => void;
  onChanged: () => void;
}) {
  const [history, setHistory] = useState<AnalysisRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [loading, setLoading] = useState(true);

  async function loadHistory() {
    const res = await fetch(`/api/analyses/${video.id}`);
    if (res.ok) {
      const data = await res.json();
      setHistory(data.history);
      setSelectedId((cur) => cur ?? data.history[0]?.id ?? null);
    } else {
      setHistory([]);
      setMode("new");
    }
    setLoading(false);
  }

  // Recarrega ao abrir e quando a análise em andamento termina.
  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id, busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const selected = history.find((a) => a.id === selectedId) ?? history[0] ?? null;
  const metrics = video.metrics ?? {};
  const isImage = video.media_type === "IMAGE" || video.media_type === "CAROUSEL_ALBUM";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-3 backdrop-blur-sm sm:p-8" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-2xl border border-gold-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* cabeçalho com capa + métricas do vídeo */}
        <div className="flex gap-4 border-b border-ink-100 p-4 sm:p-5">
          <div className="aspect-[9/16] w-20 flex-shrink-0 overflow-hidden rounded-lg bg-ink-100 sm:w-24">
            {video.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="line-clamp-2 text-sm font-medium text-ink-800">{video.caption || "Sem legenda"}</p>
              <button onClick={onClose} className="rounded-lg px-2 text-lg leading-none text-ink-400 hover:text-ink-700" aria-label="Fechar">
                ×
              </button>
            </div>
            <p className="mt-0.5 text-xs text-ink-400">
              Publicado em {formatDateTime(video.posted_at)}
              {video.permalink && (
                <>
                  {" · "}
                  <a href={video.permalink} target="_blank" rel="noopener noreferrer" className="text-gold-600 hover:underline">
                    abrir no Instagram
                  </a>
                </>
              )}
              {video.metrics_updated_at && ` · métricas de ${formatDateTime(video.metrics_updated_at)}`}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-1.5 sm:grid-cols-5">
              {VIDEO_METRICS.filter((mt) => metrics[mt.key] != null).map((mt) => (
                <div key={mt.key} title={mt.hint}>
                  <div className="text-[10px] uppercase tracking-wide text-ink-400">{mt.label}</div>
                  <div className="text-sm font-semibold text-ink-900">{formatMetric(metrics[mt.key], mt.unit, false)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5 p-4 sm:p-5">
          {isImage ? (
            <p className="rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-600">
              Este post é uma imagem ou carrossel. O Gemini só analisa vídeos.
            </p>
          ) : (
            (video.source === "competitor" || video.source === "hashtag" || video.blob_url) && (
              <VideoFileUpload video={video} onUploaded={onChanged} />
            )
          )}
          {/* histórico + nova análise */}
          <div className="flex flex-wrap items-center gap-2">
            {history.map((a, i) => (
              <button
                key={a.id}
                onClick={() => {
                  setSelectedId(a.id);
                  setMode("view");
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  mode === "view" && selected?.id === a.id ? "btn-gold" : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                }`}
              >
                {i === 0 ? "Última análise" : "Análise"} · {formatDateTime(a.requested_at)}
              </button>
            ))}
            <button
              onClick={() => setMode("new")}
              disabled={busy || isImage}
              className={`rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
                mode === "new" ? "btn-gold" : "border border-gold-300 text-gold-700 hover:bg-gold-50"
              }`}
            >
              + Nova análise com o Gemini
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-ink-400">Carregando...</p>
          ) : mode === "new" && !isImage ? (
            <NewAnalysisForm
              videoId={video.id}
              onSent={() => {
                onRequested();
                setMode("view");
                setSelectedId(null);
                setTimeout(loadHistory, 800);
              }}
            />
          ) : selected ? (
            <AnalysisView
              analysis={selected}
              onSaved={(updated) => {
                setHistory((h) => h.map((a) => (a.id === updated.id ? updated : a)));
                onChanged();
              }}
            />
          ) : (
            <p className="text-sm text-ink-400">Nenhuma análise ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function NewAnalysisForm({ videoId, onSent }: { videoId: string; onSent: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [model, setModel] = useState("");
  const [hint, setHint] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analyses")
      .then((r) => r.json())
      .then((d) => {
        setPrompt(d.default_prompt);
        setDefaultPrompt(d.default_prompt);
        setModel(d.model);
        setHint(d.categories_hint ?? "");
      });
  }, []);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ video_id: videoId, requested_by: "pedro", prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao pedir análise.");
      onSent();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-gold-200 bg-gold-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-ink-900">Prompt que será enviado ao Gemini</div>
        <Badge tone="gold">✦ Gemini · {model || "..."}</Badge>
      </div>
      <p className="text-xs text-ink-500">
        O Gemini recebe o vídeo + este texto. A resposta sempre volta em cinco campos: <strong>resumo</strong>,{" "}
        <strong>transcrição</strong>, <strong>estrutura</strong>, <strong>gancho</strong> e <strong>categorias</strong>. Você pode
        ajustar o pedido antes de enviar. O prompt usado fica salvo junto com a análise.
      </p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={12}
        className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-ink-700 outline-none focus:border-gold-400"
      />
      {hint && (
        <p className="rounded-lg bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
          <strong className="text-ink-700">Acrescentado automaticamente ao fim do prompt</strong> (para o Gemini reaproveitar as categorias
          que já existem): {hint}
        </p>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex flex-wrap justify-between gap-2">
        <button
          onClick={() => setPrompt(defaultPrompt)}
          disabled={prompt === defaultPrompt}
          className="text-xs text-ink-500 hover:text-ink-800 disabled:opacity-40"
        >
          Restaurar prompt padrão
        </button>
        <button onClick={send} disabled={sending || !prompt.trim()} className="btn-gold rounded-lg px-4 py-2 text-sm font-semibold">
          {sending ? "Enviando..." : "Enviar vídeo ao Gemini"}
        </button>
      </div>
    </div>
  );
}

function AnalysisView({ analysis, onSaved }: { analysis: AnalysisRow; onSaved: (a: AnalysisRow) => void }) {
  const busy = analysis.status === "pending" || analysis.status === "processing";
  const viaClaude = analysis.requested_by?.startsWith("claude_code");

  async function save(field: "summary" | "transcript" | "rules_fit", value: string) {
    const res = await fetch("/api/analyses", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: analysis.id, [field]: value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao salvar.");
    onSaved(data.analysis);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
        <Badge tone="gold">✦ Gerado pelo Gemini</Badge>
        <span>
          modelo <strong className="text-ink-700">{analysis.model || "não registrado"}</strong>
        </span>
        <span>· pedido por {viaClaude ? `Claude (${analysis.requested_by?.split(":")[1] ?? "cliente"})` : analysis.requested_by || "—"}</span>
        <span>· {formatDateTime(analysis.completed_at ?? analysis.requested_at)}</span>
      </div>

      {busy && (
        <div className="max-w-md space-y-2">
          <div className="text-xs text-ink-500">
            {analysis.status === "pending" ? "Enviando vídeo ao Gemini..." : "Gemini assistindo e transcrevendo o vídeo..."}
          </div>
          <ProgressBar progress={0} indeterminate />
        </div>
      )}
      {analysis.status === "error" && (
        <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          <strong>Erro na análise:</strong> {analysis.error_message || "erro desconhecido"}
        </div>
      )}

      {!busy && analysis.status !== "error" && (
        <>
          <EditableField
            title="Resumo"
            tag="gerado pelo Gemini"
            value={analysis.summary}
            onSave={(v) => save("summary", v)}
          />
          <GeminiField title="Gancho identificado pelo Gemini" value={analysis.hook} />
          <GeminiField title="Estrutura gerada pelo Gemini" value={analysis.structure} />
          <GeminiField
            title="Análise frame a frame do Gemini"
            value={analysis.frames}
            hint="o que aparece na tela segundo a segundo e como está a voz — é a base para montar as cenas"
            collapsible
          />
          <section className="rounded-xl border border-ink-100 bg-white/70 p-4">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-ink-900">Categorias</h3>
              <span className="text-[11px] text-ink-400">geradas pelo Gemini</span>
            </div>
            {analysis.categories?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {analysis.categories.map((c) => (
                  <span key={c} className="rounded-full bg-gold-100 px-2.5 py-1 text-xs font-medium text-gold-700">
                    {c}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-400">Esta análise não tem categorias (foi feita com um prompt antigo). Peça uma nova análise.</p>
            )}
          </section>
          <EditableField
            title="Transcrição"
            tag="gerada pelo Gemini"
            value={analysis.transcript}
            emptyText="Esta análise não tem transcrição (foi feita com o prompt antigo). Peça uma nova análise para transcrever."
            onSave={(v) => save("transcript", v)}
            collapsible
          />
          {analysis.patterns && (
            <EditableField title="Padrões e roteiro" tag="análise antiga do Gemini" value={analysis.patterns} readOnly />
          )}
        </>
      )}

      <EditableField
        title="Adequação às regras do Augusto"
        tag="preenchido por você ou pelo Claude"
        value={analysis.rules_fit}
        emptyText="Ainda não preenchido."
        onSave={(v) => save("rules_fit", v)}
        highlight
      />

      <details className="group rounded-xl border border-ink-100 bg-ink-50/60 p-3">
        <summary className="cursor-pointer select-none text-sm font-medium text-ink-700">
          Prompt enviado ao Gemini nesta análise
        </summary>
        <pre className="mt-3 whitespace-pre-wrap font-mono text-xs leading-relaxed text-ink-600">
          {analysis.prompt || "Prompt não registrado (análise feita antes desta versão)."}
        </pre>
      </details>
    </div>
  );
}

/** Campo sempre gerado pelo Gemini: só leitura no painel, para ficar claro de onde veio. */
function GeminiField({
  title,
  value,
  hint,
  collapsible = false,
}: {
  title: string;
  value: string | null;
  hint?: string;
  collapsible?: boolean;
}) {
  const [aberto, setAberto] = useState(!collapsible);
  return (
    <section className="rounded-xl border border-ink-100 bg-white/70 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        <span className="rounded-full bg-gold-50 px-2 py-0.5 text-[10.5px] font-medium text-gold-700">✦ Gemini</span>
        {hint && <span className="text-[11px] text-ink-400">{hint}</span>}
      </div>
      {value ? (
        <>
          <div className={`whitespace-pre-wrap text-sm leading-relaxed text-ink-700 ${aberto ? "" : "line-clamp-6"}`}>{value}</div>
          {collapsible && (
            <button onClick={() => setAberto((a) => !a)} className="mt-1 text-xs font-medium text-gold-700 hover:underline">
              {aberto ? "Recolher" : `Ver tudo (${value.split("\n").length} momentos)`}
            </button>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-400">Esta análise não tem este campo (foi feita com um prompt antigo). Peça uma nova análise.</p>
      )}
    </section>
  );
}

/** Envio manual do arquivo do vídeo, quando a Meta não libera o original (reels com música licenciada). */
function VideoFileUpload({ video, onUploaded }: { video: VideoRow; onUploaded: () => void }) {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">(video.blob_url ? "ok" : "idle");
  const [error, setError] = useState<string | null>(null);

  async function send(file: File | undefined) {
    if (!file) return;
    setStatus("sending");
    setError(null);
    try {
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(`videos/${video.id}-${file.name}`, file, { access: "public", handleUploadUrl: "/api/files/upload" });
      const res = await fetch(`/api/videos/${video.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ blob_url: blob.url }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erro ao salvar o arquivo.");
      setStatus("ok");
      onUploaded();
    } catch (err) {
      setStatus("error");
      setError((err as Error).message);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-ink-200 bg-ink-50/60 px-4 py-3 text-xs text-ink-600">
      <span>
        {status === "ok"
          ? "✓ Arquivo do vídeo enviado: o Gemini vai usar esta cópia."
          : "Se a análise falhar porque a Meta não libera o arquivo (reels com música licenciada), baixe o vídeo e envie aqui."}
        {error && <span className="ml-1 text-rose-600">{error}</span>}
      </span>
      <label className="cursor-pointer rounded-lg border border-gold-300 bg-white px-3 py-1.5 font-semibold text-gold-700 hover:bg-gold-50">
        {status === "sending" ? "Enviando..." : status === "ok" ? "Trocar arquivo" : "Enviar arquivo do vídeo"}
        <input type="file" accept="video/*" className="hidden" disabled={status === "sending"} onChange={(e) => send(e.target.files?.[0])} />
      </label>
    </div>
  );
}

function EditableField({
  title,
  tag,
  value,
  emptyText = "Vazio.",
  onSave,
  readOnly = false,
  collapsible = false,
  highlight = false,
}: {
  title: string;
  tag: string;
  value: string | null;
  emptyText?: string;
  onSave?: (value: string) => Promise<void>;
  readOnly?: boolean;
  collapsible?: boolean;
  highlight?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!collapsible);

  useEffect(() => setDraft(value ?? ""), [value]);

  async function submit() {
    if (!onSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`rounded-xl border p-4 ${highlight ? "border-gold-300 bg-gold-50/40" : "border-ink-100 bg-white/70"}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
          <span className="text-[11px] text-ink-400">{tag}</span>
        </div>
        {!readOnly && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs font-medium text-gold-700 hover:underline">
            {value ? "Editar" : "Preencher"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            autoFocus
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm leading-relaxed text-ink-700 outline-none focus:border-gold-400"
          />
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setDraft(value ?? "");
                setEditing(false);
              }}
              className="rounded-lg px-3 py-1.5 text-xs text-ink-500 hover:bg-ink-100"
            >
              Cancelar
            </button>
            <button onClick={submit} disabled={saving} className="btn-gold rounded-lg px-4 py-1.5 text-xs font-semibold">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      ) : value ? (
        <div>
          <div className={`whitespace-pre-wrap text-sm leading-relaxed text-ink-700 ${expanded ? "" : "line-clamp-6"}`}>{value}</div>
          {collapsible && (
            <button onClick={() => setExpanded((e) => !e)} className="mt-1 text-xs font-medium text-gold-700 hover:underline">
              {expanded ? "Recolher" : "Ver tudo"}
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink-400">{emptyText}</p>
      )}
    </section>
  );
}
