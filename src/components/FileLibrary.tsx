"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { GlassCard, Badge, EmptyState, ProgressBar } from "@/components/ui";
import { FILE_CATEGORIES, fileCategoryLabel } from "@/lib/fileCategories";
import type { FileRow } from "@/lib/types";

const CATEGORIES = FILE_CATEGORIES;
const categoryLabel = fileCategoryLabel;

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function formatDate(d: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(d));
}

type UploadItem = { name: string; status: "enviando" | "lendo" | "ok" | "erro"; error?: string };

export default function FileLibrary() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [uploadCategory, setUploadCategory] = useState("roteiro_antigo");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter) params.set("category", filter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/files?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar arquivos.");
      setFiles(data.files);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search]);

  async function handleFiles(list: FileList | null) {
    if (!list?.length) return;
    const items = Array.from(list);
    setUploads(items.map((f) => ({ name: f.name, status: "enviando" })));
    const setStatus = (i: number, patch: Partial<UploadItem>) =>
      setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, ...patch } : u)));

    await Promise.all(
      items.map(async (file, i) => {
        try {
          const blob = await upload(`biblioteca/${file.name}`, file, {
            access: "public",
            handleUploadUrl: "/api/files/upload",
          });
          setStatus(i, { status: "lendo" });
          const res = await fetch("/api/files", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name: file.name,
              blob_url: blob.url,
              content_type: file.type || null,
              size_bytes: file.size,
              category: uploadCategory,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Erro ao registrar arquivo.");
          setStatus(i, { status: "ok" });
        } catch (err) {
          setStatus(i, { status: "erro", error: (err as Error).message });
        }
      })
    );
    await load();
    setTimeout(() => setUploads((prev) => prev.filter((u) => u.status === "erro")), 2500);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
            Biblioteca de <span className="gold-gradient-text">arquivos</span>
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Roteiros antigos, transcrições de aula e materiais de referência. O texto de cada arquivo fica disponível para o Claude do Augusto ler e pesquisar.
          </p>
        </div>
        <button
          onClick={() => setShowPaste((v) => !v)}
          className="rounded-xl border border-ink-200 bg-white/70 px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-white"
        >
          + Colar texto
        </button>
      </div>

      {showPaste && (
        <PasteTextForm
          onCreated={() => {
            setShowPaste(false);
            load();
          }}
        />
      )}

      {/* área de upload */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
          dragging ? "border-gold-400 bg-gold-50/60" : "border-ink-200 bg-white/40"
        }`}
      >
        <p className="text-sm text-ink-600">Arraste arquivos aqui ou</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <select
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value)}
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button onClick={() => inputRef.current?.click()} className="btn-gold rounded-lg px-4 py-2 text-sm font-semibold">
            Escolher arquivos
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        <p className="mt-2 text-xs text-ink-400">O texto é lido automaticamente de TXT, MD, DOCX, PDF, SRT e VTT. Outros formatos ficam guardados sem texto.</p>

        {uploads.length > 0 && (
          <div className="mx-auto mt-4 max-w-md space-y-2 text-left">
            {uploads.map((u, i) => (
              <div key={`${u.name}-${i}`} className="text-xs">
                <div className="flex justify-between gap-2">
                  <span className="truncate text-ink-700">{u.name}</span>
                  <span className={u.status === "erro" ? "text-rose-600" : "text-ink-400"}>
                    {u.status === "enviando" ? "enviando..." : u.status === "lendo" ? "lendo o texto..." : u.status === "ok" ? "pronto" : "erro"}
                  </span>
                </div>
                {(u.status === "enviando" || u.status === "lendo") && <ProgressBar progress={0} indeterminate />}
                {u.error && <p className="text-rose-600">{u.error}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-2xl bg-white/60 p-1">
          {[{ id: "", label: "Todos" }, ...CATEGORIES].map((c) => (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                filter === c.id ? "btn-gold" : "text-ink-500 hover:bg-white hover:text-ink-800"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar no nome ou no texto..."
          className="min-w-[220px] flex-1 rounded-xl border border-ink-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-gold-400"
        />
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-ink-400">Carregando...</div>
      ) : error ? (
        <GlassCard className="p-5 text-sm text-rose-600">{error}</GlassCard>
      ) : files.length === 0 ? (
        <EmptyState
          title={search || filter ? "Nenhum arquivo encontrado" : "Nenhum arquivo ainda"}
          description={search || filter ? "Tente outra busca ou categoria." : "Envie roteiros antigos e transcrições de aula para o Claude usar como referência."}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((f) => (
            <GlassCard key={f.id} strong className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => setOpenId(f.id)} className="min-w-0 text-left">
                  <div className="truncate text-sm font-semibold text-ink-900 hover:text-gold-700">{f.name}</div>
                  <div className="text-xs text-ink-400">
                    {formatSize(f.size_bytes)} · {formatDate(f.created_at)} · {f.source === "claude_code" ? "via Claude" : "enviado por você"}
                  </div>
                </button>
                <Badge tone="gold">{categoryLabel(f.category)}</Badge>
              </div>
              {f.description && <p className="line-clamp-2 text-xs text-ink-600">{f.description}</p>}
              <div className="mt-auto flex items-center justify-between pt-1 text-xs">
                <span className={f.text_length ? "text-ink-500" : "text-amber-600"}>
                  {f.text_length
                    ? `${new Intl.NumberFormat("pt-BR").format(f.text_length)} caracteres · ${new Intl.NumberFormat("pt-BR").format(f.section_count ?? 0)} títulos`
                    : "sem texto extraído"}
                </span>
                <button onClick={() => setOpenId(f.id)} className="font-medium text-gold-700 hover:underline">
                  Abrir
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {openId && (
        <FileModal
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={load}
          onDeleted={() => {
            setOpenId(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function PasteTextForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("transcricao_aula");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, category, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar.");
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard className="space-y-3 p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome (ex.: Aula 3 — gestão de tempo)"
          className="rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-gold-400 sm:col-span-2"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-sm text-ink-700 outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder="Cole o texto aqui"
        className="w-full rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-gold-400"
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex justify-end">
        <button onClick={save} disabled={saving || !name.trim() || !text.trim()} className="btn-gold rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60">
          {saving ? "Salvando..." : "Salvar na biblioteca"}
        </button>
      </div>
    </GlassCard>
  );
}

type SectionItem = { id: string; position: number; level: number; title: string; char_count: number };

/** Navegação pelos títulos do arquivo: lista à esquerda, conteúdo da seção à direita. */
function SectionsViewer({ fileId, preview }: { fileId: string; preview: string | null }) {
  const [sections, setSections] = useState<SectionItem[] | null>(null);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/files/${fileId}/sections`)
      .then((r) => r.json())
      .then((d) => {
        setSections(d.sections ?? []);
        if (d.sections?.[0]) setSelected(d.sections[0].id);
      });
  }, [fileId]);

  useEffect(() => {
    if (!selected) return;
    setContent(null);
    fetch(`/api/files/${fileId}/sections?section=${selected}`)
      .then((r) => r.json())
      .then((d) => setContent(d.section?.content ?? ""));
  }, [fileId, selected]);

  if (sections === null) return <p className="text-sm text-ink-400">Carregando títulos...</p>;
  if (sections.length === 0) {
    return (
      <pre className="scrollbar-thin max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-xl bg-ink-50 p-4 text-xs leading-relaxed text-ink-700">
        {preview || "Nenhum texto extraído deste arquivo."}
      </pre>
    );
  }

  const term = filter.trim().toLowerCase();
  const visible = term ? sections.filter((s) => s.title.toLowerCase().includes(term)) : sections;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
        <span>
          {sections.length} títulos · organizado automaticamente (o Claude pede cada parte pelo título)
        </span>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar títulos..."
          className="rounded-lg border border-ink-200 px-2 py-1 text-xs outline-none focus:border-gold-400"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ul className="scrollbar-thin max-h-[50vh] overflow-auto rounded-xl border border-ink-100 bg-white p-1">
          {visible.slice(0, 1500).map((s) => (
            <li key={s.id}>
              <button
                onClick={() => setSelected(s.id)}
                className={`w-full rounded-lg px-2 py-1 text-left text-xs leading-snug ${
                  selected === s.id ? "bg-gold-100 text-gold-800" : "text-ink-700 hover:bg-ink-50"
                } ${s.level === 1 ? "font-semibold" : ""}`}
                style={{ paddingLeft: `${(s.level - 1) * 12 + 8}px` }}
              >
                {s.title}
              </button>
            </li>
          ))}
          {visible.length > 1500 && <li className="px-2 py-1 text-xs text-ink-400">+{visible.length - 1500} títulos: use o filtro</li>}
        </ul>
        <pre className="scrollbar-thin max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-xl bg-ink-50 p-4 text-xs leading-relaxed text-ink-700">
          {content ?? "Carregando..."}
        </pre>
      </div>
    </div>
  );
}

function FileModal({
  id,
  onClose,
  onChanged,
  onDeleted,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [file, setFile] = useState<FileRow | null>(null);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/files/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setFile(d.file);
        setCategory(d.file?.category ?? "outro");
        setDescription(d.file?.description ?? "");
      });
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setSaving(true);
    await fetch(`/api/files/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category, description }),
    });
    setSaving(false);
    onChanged();
  }

  async function remove() {
    if (!confirm("Apagar este arquivo da biblioteca? Não dá para desfazer.")) return;
    await fetch(`/api/files/${id}`, { method: "DELETE" });
    onDeleted();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-3 backdrop-blur-sm sm:p-8" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl border border-gold-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {!file ? (
          <p className="p-6 text-sm text-ink-400">Carregando...</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-ink-100 p-5">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-ink-900">{file.name}</h2>
                <p className="text-xs text-ink-400">
                  {formatSize(file.size_bytes)} · {formatDate(file.created_at)}
                  {file.blob_url && (
                    <>
                      {" · "}
                      <a href={file.blob_url} target="_blank" rel="noopener noreferrer" className="text-gold-600 hover:underline">
                        abrir arquivo original
                      </a>
                    </>
                  )}
                </p>
              </div>
              <button onClick={onClose} className="px-2 text-lg leading-none text-ink-400 hover:text-ink-700" aria-label="Fechar">
                ×
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                  {!CATEGORIES.some((c) => c.id === category) && <option value={category}>{category}</option>}
                </select>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição (opcional)"
                  className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-gold-400 sm:col-span-2"
                />
              </div>
              <div className="flex justify-between">
                <button onClick={remove} className="text-xs text-rose-600 hover:underline">
                  Apagar arquivo
                </button>
                <button onClick={save} disabled={saving} className="btn-gold rounded-lg px-4 py-1.5 text-xs font-semibold">
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
              {file.content_type?.startsWith("image/") && file.blob_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={file.blob_url} alt={file.name} className="max-h-[60vh] w-full rounded-xl object-contain" />
              ) : (
                <SectionsViewer fileId={file.id} preview={file.text_content ?? null} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
