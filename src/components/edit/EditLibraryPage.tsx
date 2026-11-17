"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { GlassCard, Badge, EmptyState, ProgressBar } from "@/components/ui";
import Markdown from "@/components/edit/Markdown";

type Kind = "formato" | "regra" | "referencia" | "guia";
type Note = {
  id: string;
  slug: string;
  kind: Kind;
  title: string;
  summary: string | null;
  body_md: string;
  tags: string[];
  format_slug: string | null;
  media_url: string | null;
  source: string | null;
  pinned: boolean;
  updated_at: string;
};
type FullNote = Note & {
  links: string[];
  backlinks: { slug: string; title: string; kind: Kind }[];
  rules: Note[];
  revisions: { id: string; changed_by: string | null; change_note: string | null; created_at: string }[];
};

type Metric = {
  format_slug: string;
  videos: number;
  avg_views: number | null;
  median_views: number | null;
  avg_saves: number | null;
  avg_shares: number | null;
  avg_comments: number | null;
  engagement_rate: number | null;
  last_posted_at: string | null;
  total_views: number | null;
  top: { id: string; caption: string | null; permalink: string | null; views: number | null; saves: number | null; thumb_url: string | null }[];
};
const nf = (n: number | null | undefined) => (n == null ? "—" : new Intl.NumberFormat("pt-BR", { notation: n >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n));

const KIND_LABEL: Record<Kind, string> = { formato: "Formato", regra: "Regra", referencia: "Referência", guia: "Guia" };
const KIND_TONE: Record<Kind, "gold" | "success" | "warning" | "neutral"> = { formato: "gold", regra: "success", referencia: "warning", guia: "neutral" };

const fmtDate = (d: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(d));
const who = (s: string | null) => (s ? (s === "painel" ? "painel" : s.startsWith("claude") ? s : `Claude · ${s}`) : "—");

export default function EditLibraryPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [open, setOpen] = useState<FullNote | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", body_md: "", why: "" });
  const [creating, setCreating] = useState<Kind | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const metricOf = (slug: string) => metrics.find((m) => m.format_slug === slug);

  async function load() {
    try {
      const r = await fetch("/api/edit-notes");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setNotes(d.notes);
      setError(null);
      fetch("/api/edit-notes/metrics").then((r) => r.json()).then((m) => setMetrics(m.metrics ?? [])).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // link direto para uma nota: /?nota=slug (o Claude manda esse link)
    const nota = new URLSearchParams(window.location.search).get("nota");
    if (nota) setOpenSlug(nota);
  }, []);

  useEffect(() => {
    if (!openSlug) return setOpen(null);
    setEditing(false);
    fetch(`/api/edit-notes/${encodeURIComponent(openSlug)}`)
      .then((r) => r.json())
      .then((d) => (d.note ? setOpen(d.note) : setError(d.error)));
  }, [openSlug]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return notes;
    return notes.filter((n) => `${n.title} ${n.summary ?? ""} ${n.body_md} ${n.tags.join(" ")}`.toLowerCase().includes(t));
  }, [notes, q]);
  const by = (k: Kind) => filtered.filter((n) => n.kind === k);
  const formatos = by("formato").sort((a, b) => (metricOf(b.slug)?.avg_views ?? -1) - (metricOf(a.slug)?.avg_views ?? -1));

  async function save() {
    if (!open) return;
    const r = await fetch(`/api/edit-notes/${open.slug}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: draft.title, body_md: draft.body_md, change_note: draft.why || "editada no painel" }),
    });
    if (r.ok) {
      setEditing(false);
      await load();
      setOpenSlug(null);
      setTimeout(() => setOpenSlug(open.slug), 0);
    }
  }

  async function archive() {
    if (!open || !confirm(`Arquivar "${open.title}"? O histórico continua guardado.`)) return;
    await fetch(`/api/edit-notes/${open.slug}`, { method: "DELETE" });
    setOpenSlug(null);
    load();
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <GlassCard strong className="overflow-hidden p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">Biblioteca de Edição</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900 md:text-4xl">Como os vídeos do Titã são editados</h1>
            <p className="mt-3 text-ink-500">
              Formatos, regras e referências que qualquer Claude conectado lê antes de editar — e atualiza sozinho toda vez que o Augusto pede
              uma mudança. A memória da edição fica aqui, sempre melhorando.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center">
            {(["formato", "regra", "referencia", "guia"] as Kind[]).map((k) => (
              <div key={k} className="rounded-2xl bg-white/70 px-4 py-3">
                <div className="text-2xl font-semibold text-ink-900">{notes.filter((n) => n.kind === k).length}</div>
                <div className="text-[11px] uppercase tracking-wider text-ink-400">{KIND_LABEL[k]}s</div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar em formatos, regras e referências…"
            className="min-w-[260px] flex-1 rounded-full border border-ink-200 bg-white/80 px-5 py-2.5 text-sm outline-none focus:border-gold-400"
          />
          <button onClick={() => setCreating("formato")} className="btn-gold rounded-full px-5 py-2 text-sm font-semibold">+ Formato</button>
          <button onClick={() => setCreating("regra")} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50">+ Regra</button>
          <button onClick={() => setCreating("guia")} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50">+ Guia</button>
        </div>
      </GlassCard>

      {error && <GlassCard className="p-4 text-sm text-rose-700">{error}</GlassCard>}
      {loading && <ProgressBar progress={0} indeterminate />}

      {/* Formatos: fileiras de cards com as capas empilhadas, botão copiar prompt e métricas */}
      <section>
        <div className="mb-4 flex items-end justify-between px-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Formatos do Titã</h2>
          <span className="text-xs text-ink-400">copie o prompt e cole no Claude para editar no formato</span>
        </div>
        {!loading && formatos.length === 0 ? (
          <EmptyState title="Nenhum formato ainda" description="Rode npm run seed:edicao para carregar os formatos do Titã, ou crie um." />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {formatos.map((f) => <FormatCard key={f.id} note={f} metric={metricOf(f.slug)} onOpen={() => setOpenSlug(f.slug)} />)}
          </div>
        )}
      </section>

      {metrics.length > 0 && <PerformancePanel metrics={metrics} notes={notes} onOpen={setOpenSlug} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Regras + guias + referências */}
        <div className="space-y-6">
          <NoteList title="Regras e preferências do Augusto" hint="Cada correção que ele pede vira uma regra — vale acima da ficha do formato." notes={by("regra")} onOpen={setOpenSlug} formatos={notes} />
          <NoteList title="Guias gerais" hint="Identidade, cenário, pipeline e ferramentas." notes={by("guia")} onOpen={setOpenSlug} formatos={notes} />
          <NoteList title="Referências de concorrentes" hint="Edições que o Gemini aprendeu, com o prompt pronto." notes={by("referencia")} onOpen={setOpenSlug} formatos={notes} />
        </div>
        <div className="space-y-6">
          <LearnCompetitor onDone={(slug) => { load(); setOpenSlug(slug); }} />
          <ConnectCard />
        </div>
      </div>

      {/* Leitor da nota */}
      {open && (
        <div className="fixed inset-0 z-40 flex justify-end bg-ink-900/30 backdrop-blur-sm" onClick={() => setOpenSlug(null)}>
          <div className="h-full w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-2xl md:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone={KIND_TONE[open.kind]}>{KIND_LABEL[open.kind]}</Badge>
                  <code className="text-xs text-ink-400">[[{open.slug}]]</code>
                </div>
                {editing ? (
                  <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="mt-2 w-full rounded-lg border border-ink-200 px-3 py-2 text-2xl font-semibold" />
                ) : (
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">{open.title}</h2>
                )}
                <div className="mt-1 text-xs text-ink-400">
                  Atualizada {fmtDate(open.updated_at)} · {open.revisions.length} versões
                  {open.format_slug && <> · vale para <button className="text-gold-700 underline" onClick={() => setOpenSlug(open.format_slug!)}>{open.format_slug}</button></>}
                  {open.kind === "regra" && !open.format_slug && <> · vale para todos os formatos</>}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {!editing && (
                  <button onClick={() => { setDraft({ title: open.title, body_md: open.body_md, why: "" }); setEditing(true); }} className="rounded-full bg-ink-900 px-4 py-1.5 text-sm text-gold-200">
                    Editar
                  </button>
                )}
                <button onClick={() => setOpenSlug(null)} className="rounded-full bg-ink-100 px-3 py-1.5 text-sm">✕</button>
              </div>
            </div>

            {open.media_url && !editing && (
              /\.(png|jpe?g|webp|gif)(\?|$)/i.test(open.media_url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={open.media_url} alt="" className="mt-5 max-h-80 rounded-xl" />
              ) : (
                <video src={open.media_url} controls className="mt-5 max-h-96 rounded-xl" />
              )
            )}

            {editing ? (
              <div className="mt-5 space-y-3">
                <textarea value={draft.body_md} onChange={(e) => setDraft({ ...draft, body_md: e.target.value })} className="h-[55vh] w-full rounded-xl border border-ink-200 p-4 font-mono text-sm" />
                <input value={draft.why} onChange={(e) => setDraft({ ...draft, why: e.target.value })} placeholder="O que mudou? (fica no histórico)" className="w-full rounded-full border border-ink-200 px-4 py-2 text-sm" />
                <div className="flex justify-between">
                  <button onClick={archive} className="text-sm text-rose-600">Arquivar nota</button>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(false)} className="rounded-full bg-ink-100 px-4 py-2 text-sm">Cancelar</button>
                    <button onClick={save} className="btn-gold rounded-full px-5 py-2 text-sm font-semibold">Salvar versão</button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4"><Markdown md={open.body_md} onLink={setOpenSlug} /></div>

                {open.kind === "formato" && metricOf(open.slug) && (
                  <div className="mt-6 rounded-2xl border border-gold-200 bg-gold-50/50 p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-gold-700">Desempenho no perfil</h3>
                    <div className="mt-3 grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
                      {([
                        ["vídeos", metricOf(open.slug)!.videos],
                        ["views médias", metricOf(open.slug)!.avg_views],
                        ["mediana", metricOf(open.slug)!.median_views],
                        ["salvamentos", metricOf(open.slug)!.avg_saves],
                        ["compart.", metricOf(open.slug)!.avg_shares],
                      ] as [string, number | null][]).map(([l, v]) => (
                        <div key={l}><div className="text-lg font-semibold text-ink-900">{nf(v)}</div><div className="text-[10px] uppercase tracking-wider text-ink-400">{l}</div></div>
                      ))}
                      <div><div className="text-lg font-semibold text-ink-900">{metricOf(open.slug)!.engagement_rate ?? "—"}%</div><div className="text-[10px] uppercase tracking-wider text-ink-400">engajamento</div></div>
                    </div>
                    <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-ink-500">Melhores vídeos deste formato</div>
                    <ol className="mt-2 space-y-1 text-sm">
                      {metricOf(open.slug)!.top.map((t) => (
                        <li key={t.id} className="flex justify-between gap-3">
                          <a href={t.permalink ?? "#"} target="_blank" rel="noreferrer" className="truncate text-ink-700 underline decoration-gold-300 hover:text-gold-700">{t.caption || "post"}</a>
                          <span className="shrink-0 text-ink-400">{nf(t.views)} views · {nf(t.saves)} salv.</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {open.kind === "formato" && (
                  <div className="mt-8">
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-500">Regras aplicadas ({open.rules.length})</h3>
                    <div className="space-y-2">
                      {open.rules.map((r) => (
                        <button key={r.id} onClick={() => setOpenSlug(r.slug)} className="block w-full rounded-xl border border-ink-100 bg-emerald-50/50 p-3 text-left text-sm hover:border-emerald-300">
                          <div className="font-medium text-ink-900">{r.title}</div>
                          <div className="text-xs text-ink-400">{r.format_slug ? "deste formato" : "todos os formatos"} · {who(r.source)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {open.backlinks.length > 0 && (
                  <div className="mt-8">
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-500">Citada em</h3>
                    <div className="flex flex-wrap gap-2">
                      {open.backlinks.map((b) => (
                        <button key={b.slug} onClick={() => setOpenSlug(b.slug)} className="rounded-full bg-ink-100 px-3 py-1 text-sm hover:bg-gold-100">{b.title}</button>
                      ))}
                    </div>
                  </div>
                )}

                <details className="mt-8 text-sm">
                  <summary className="cursor-pointer font-semibold uppercase tracking-wider text-ink-500">Histórico</summary>
                  <ul className="mt-2 space-y-1 text-ink-500">
                    {open.revisions.map((r) => (
                      <li key={r.id}>{fmtDate(r.created_at)} — {r.change_note || "alteração"} <span className="text-ink-400">({who(r.changed_by)})</span></li>
                    ))}
                  </ul>
                </details>
              </>
            )}
          </div>
        </div>
      )}

      {creating && <CreateDialog kind={creating} formatos={notes.filter((n) => n.kind === "formato")} onClose={() => setCreating(null)} onCreated={(slug) => { setCreating(null); load(); setOpenSlug(slug); }} />}
    </div>
  );
}

function NoteList({ title, hint, notes, onOpen, formatos }: { title: string; hint: string; notes: Note[]; onOpen: (s: string) => void; formatos: Note[] }) {
  const fmtTitle = (s: string | null) => (s ? formatos.find((f) => f.slug === s)?.title ?? s : "Todos os formatos");
  return (
    <GlassCard className="p-5">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        <p className="text-xs text-ink-400">{hint}</p>
      </div>
      {notes.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-400">Nada aqui ainda.</p>
      ) : (
        <div className="divide-y divide-ink-100">
          {notes.map((n) => (
            <button key={n.id} onClick={() => onOpen(n.slug)} className="flex w-full items-start justify-between gap-4 py-3 text-left hover:bg-white/50">
              <div className="min-w-0">
                <div className="truncate font-medium text-ink-800">{n.title}</div>
                <div className="line-clamp-1 text-xs text-ink-400">{n.summary || n.body_md.replace(/[#*>_`\[\]]/g, "").slice(0, 140)}</div>
              </div>
              <div className="shrink-0 text-right text-[11px] text-ink-400">
                {n.kind === "regra" && <div>{fmtTitle(n.format_slug)}</div>}
                <div>{fmtDate(n.updated_at)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function LearnCompetitor({ onDone }: { onDone: (slug: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [competitor, setCompetitor] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"" | "enviando" | "analisando" | "erro">("");
  const [msg, setMsg] = useState("");
  const [pct, setPct] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function run() {
    if (!file) return;
    try {
      setStatus("enviando");
      setMsg("");
      const blob = await upload(`referencias-edicao/${Date.now()}-${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/files/upload",
        onUploadProgress: (p) => setPct(p.percentage),
      });
      setStatus("analisando");
      const r = await fetch("/api/edit-notes/learn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ media_url: blob.url, competitor: competitor || undefined, notes: notes || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setStatus("");
      setFile(null);
      setCompetitor("");
      setNotes("");
      onDone(d.note.slug);
    } catch (e) {
      setStatus("erro");
      setMsg((e as Error).message);
    }
  }

  return (
    <GlassCard strong className="p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-600">Aprender edição</div>
      <h2 className="mt-1 text-lg font-semibold text-ink-900">Puxar o modelo de edição de um concorrente</h2>
      <p className="mt-1 text-sm text-ink-500">Envie o vídeo (ou um print) de uma edição que o Augusto gostou. O Gemini estuda a edição e devolve a ficha + um prompt pronto para editar no mesmo estilo.</p>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
        }}
        className="mt-4 cursor-pointer rounded-2xl border-2 border-dashed border-gold-300 bg-white/60 p-5 text-center text-sm text-ink-500 hover:bg-gold-50"
      >
        {file ? <span className="font-medium text-ink-800">{file.name}</span> : "Arraste aqui ou clique — vídeo ou imagem"}
        <input ref={inputRef} type="file" accept="video/*,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <input value={competitor} onChange={(e) => setCompetitor(e.target.value)} placeholder="@ do concorrente (opcional)" className="mt-3 w-full rounded-full border border-ink-200 bg-white px-4 py-2 text-sm" />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="O que chamou atenção? (opcional — ex.: as legendas e o zoom)" className="mt-2 h-20 w-full rounded-2xl border border-ink-200 bg-white px-4 py-2 text-sm" />
      {status === "enviando" && <div className="mt-3"><ProgressBar progress={pct} /><p className="mt-1 text-xs text-ink-400">Enviando… {Math.round(pct)}%</p></div>}
      {status === "analisando" && <div className="mt-3"><ProgressBar progress={0} indeterminate /><p className="mt-1 text-xs text-ink-400">O Gemini está assistindo e estudando a edição (1 a 3 min)…</p></div>}
      {status === "erro" && <p className="mt-3 text-sm text-rose-600">{msg}</p>}
      <button disabled={!file || status === "enviando" || status === "analisando"} onClick={run} className="btn-gold mt-4 w-full rounded-full py-2.5 text-sm font-semibold disabled:opacity-50">
        Gerar ficha e prompt
      </button>
    </GlassCard>
  );
}

function ConnectCard() {
  return (
    <GlassCard className="p-5 text-sm text-ink-600">
      <h2 className="text-base font-semibold text-ink-900">Como o Claude usa esta biblioteca</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>Ao editar um vídeo, ele chama <code>get_edit_briefing</code> com o formato e recebe ficha + regras + guias.</li>
        <li>Quando o Augusto diz algo como <em>“lembre que eu sempre olho pra baixo pra ler, corta essa parte”</em>, ele chama <code>save_edit_preference</code> e a regra aparece aqui.</li>
        <li>Para copiar a edição de alguém, <code>learn_competitor_edit</code> com o link do vídeo.</li>
      </ol>
      <a href="/integracoes" className="mt-4 inline-block text-gold-700 underline">Conectar um Claude →</a>
    </GlassCard>
  );
}

function CreateDialog({ kind, formatos, onClose, onCreated }: { kind: Kind; formatos: Note[]; onClose: () => void; onCreated: (slug: string) => void }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [fmt, setFmt] = useState("");
  const [err, setErr] = useState("");
  async function create() {
    const r = await fetch("/api/edit-notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, title, summary: summary || undefined, body_md: body, format_slug: kind === "regra" && fmt ? fmt : null }),
    });
    const d = await r.json();
    if (!r.ok) return setErr(d.error);
    onCreated(d.note.slug);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold">Novo {KIND_LABEL[kind].toLowerCase()}</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="mt-4 w-full rounded-lg border border-ink-200 px-3 py-2" />
        {kind !== "regra" && <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Resumo em uma frase" className="mt-2 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm" />}
        {kind === "regra" && (
          <select value={fmt} onChange={(e) => setFmt(e.target.value)} className="mt-2 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm">
            <option value="">Vale para todos os formatos</option>
            {formatos.map((f) => <option key={f.slug} value={f.slug}>{f.title}</option>)}
          </select>
        )}
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Markdown. Use [[slug]] para ligar a outra nota." className="mt-2 h-64 w-full rounded-lg border border-ink-200 p-3 font-mono text-sm" />
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full bg-ink-100 px-4 py-2 text-sm">Cancelar</button>
          <button disabled={!title} onClick={create} className="btn-gold rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-50">Criar</button>
        </div>
      </div>
    </div>
  );
}

function PerformancePanel({ metrics, notes, onOpen }: { metrics: Metric[]; notes: Note[]; onOpen: (s: string) => void }) {
  const title = (slug: string) => notes.find((n) => n.slug === slug)?.title ?? (slug === "outros" ? "Outros (montagens isoladas)" : slug);
  const max = Math.max(...metrics.map((m) => m.avg_views ?? 0), 1);
  const total = metrics.reduce((a, m) => a + m.videos, 0);
  return (
    <GlassCard className="p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-600">Métrica do perfil</div>
          <h2 className="mt-1 text-lg font-semibold text-ink-900">Desempenho por formato de edição</h2>
        </div>
        <p className="text-xs text-ink-400">{total} Reels do @augustotita · números da Meta · média por vídeo</p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-ink-400">
              <th className="py-2 pr-3 font-medium">Formato</th>
              <th className="px-3 font-medium">Vídeos</th>
              <th className="w-[34%] px-3 font-medium">Views médias</th>
              <th className="px-3 text-right font-medium">Salv.</th>
              <th className="px-3 text-right font-medium">Compart.</th>
              <th className="px-3 text-right font-medium">Coment.</th>
              <th className="pl-3 text-right font-medium">Engaj.</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, i) => (
              <tr key={m.format_slug} className="border-t border-ink-100">
                <td className="py-2.5 pr-3">
                  <button disabled={m.format_slug === "outros"} onClick={() => onOpen(m.format_slug)} className="text-left font-medium text-ink-800 hover:text-gold-700 disabled:cursor-default disabled:text-ink-400">
                    {i === 0 && <span className="mr-1">🏆</span>}{title(m.format_slug)}
                  </button>
                </td>
                <td className="px-3 text-ink-500">{m.videos}</td>
                <td className="px-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-ink-100">
                      <div className="h-2 rounded-full bg-gradient-to-r from-gold-300 to-gold-500" style={{ width: `${((m.avg_views ?? 0) / max) * 100}%` }} />
                    </div>
                    <span className="w-14 text-right font-semibold text-ink-900">{nf(m.avg_views)}</span>
                  </div>
                </td>
                <td className="px-3 text-right text-ink-600">{nf(m.avg_saves)}</td>
                <td className="px-3 text-right text-ink-600">{nf(m.avg_shares)}</td>
                <td className="px-3 text-right text-ink-600">{nf(m.avg_comments)}</td>
                <td className="pl-3 text-right text-ink-600">{m.engagement_rate ?? "—"}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

/** Card de formato: capas dos Reels empilhadas (cada uma mais à direita e mais transparente),
 *  título, botão "Copiar prompt" e as métricas em 3 colunas de texto pequeno. */
function FormatCard({ note, metric, onOpen }: { note: Note; metric?: Metric; onOpen: () => void }) {
  const [state, setState] = useState<"" | "copiando" | "copiado" | "erro">("");
  const thumbs = (metric?.top ?? []).filter((t) => t.thumb_url).slice(0, 5);

  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    setState("copiando");
    try {
      // ClipboardItem com Promise mantém o gesto do clique enquanto o prompt chega do servidor
      const text = fetch(`/api/edit-notes/${note.slug}/prompt`).then((r) => r.text());
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })) })]);
      } else {
        await navigator.clipboard.writeText(await text);
      }
      setState("copiado");
      setTimeout(() => setState(""), 2200);
    } catch {
      setState("erro");
    }
  }

  const stats: [string, string][] = metric
    ? [
        ["views no formato", nf(metric.total_views)],
        ["vídeos", String(metric.videos)],
        ["média por vídeo", nf(metric.avg_views)],
        ["salvamentos/vídeo", nf(metric.avg_saves)],
        ["compart./vídeo", nf(metric.avg_shares)],
        ["engajamento", metric.engagement_rate != null ? `${metric.engagement_rate}%` : "—"],
      ]
    : [];

  return (
    <GlassCard className="flex flex-col overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-goldGlow">
      <button onClick={onOpen} className="relative block h-64 w-full overflow-hidden bg-gradient-to-br from-ink-900 to-ink-800 text-left">
        {thumbs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-400">sem capas ainda</div>
        ) : (
          <div className="absolute inset-y-5 left-6 right-0">
            {thumbs.map((t, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={t.id}
                src={t.thumb_url!}
                alt=""
                loading="lazy"
                className="absolute top-0 h-full rounded-xl object-cover shadow-[0_12px_30px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
                style={{
                  left: i * 38,
                  aspectRatio: "9 / 16",
                  zIndex: 10 - i,
                  opacity: [1, 0.72, 0.48, 0.28, 0.14][i],
                  transform: `scale(${1 - i * 0.045})`,
                  transformOrigin: "left center",
                }}
              />
            ))}
          </div>
        )}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-ink-900 to-transparent" />
      </button>

      <div className="flex flex-1 flex-col p-5">
        <button onClick={onOpen} className="text-left">
          <div className="text-base font-semibold leading-snug text-ink-900">{note.title}</div>
          <p className="mt-1 line-clamp-2 text-xs text-ink-500">{note.summary}</p>
        </button>

        <button
          onClick={copy}
          className={`mt-4 w-full rounded-full py-2.5 text-sm font-semibold transition ${state === "copiado" ? "bg-emerald-500 text-white" : "btn-gold"}`}
        >
          {state === "copiando" ? "Copiando…" : state === "copiado" ? "Prompt copiado ✓" : state === "erro" ? "Não deu — tente de novo" : "Copiar prompt do formato"}
        </button>

        {stats.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-2.5">
            {stats.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-ink-800">{value}</div>
                <div className="truncate text-[10px] text-ink-400">{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
