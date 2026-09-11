/**
 * Biblioteca de arquivos: roteiros antigos, transcrições de aula etc.
 * O arquivo original fica no Vercel Blob e o texto extraído fica em
 * files.text_content, que é o que o Claude do Augusto lê e pesquisa.
 */
import { put, del } from "@vercel/blob";
import { query, queryOne } from "@/lib/db";
import type { FileRow } from "@/lib/types";

export const FILE_CATEGORIES = [
  { id: "roteiro_antigo", label: "Roteiro antigo" },
  { id: "transcricao_aula", label: "Transcrição de aula" },
  { id: "outro", label: "Outro" },
];

export class FileInputError extends Error {}

// Lista sem o texto inteiro (pode ser grande); get_file traz o conteúdo.
const LIST_COLUMNS = `id, name, category, description, blob_url, content_type, size_bytes, source,
  created_by, created_at, updated_at, coalesce(length(text_content), 0)::int as text_length`;

export async function listFiles(opts: { category?: string; search?: string } = {}): Promise<FileRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.category) {
    params.push(opts.category);
    where.push(`category = $${params.length}`);
  }
  if (opts.search) {
    params.push(`%${opts.search}%`);
    where.push(`(name ilike $${params.length} or description ilike $${params.length} or text_content ilike $${params.length})`);
  }
  return query<FileRow>(
    `select ${LIST_COLUMNS} from files ${where.length ? `where ${where.join(" and ")}` : ""} order by created_at desc`,
    params
  );
}

export async function getFile(id: string): Promise<FileRow | null> {
  return queryOne<FileRow>(`select * from files where id = $1`, [id]);
}

const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|json|srt|vtt|html?|xml|rtf)$/i;

/** Extrai texto de arquivos comuns; devolve null quando o formato não tem texto legível. */
export async function extractText(buffer: Buffer, fileName: string, contentType?: string | null): Promise<string | null> {
  const name = fileName.toLowerCase();
  try {
    if (name.endsWith(".pdf") || contentType === "application/pdf") {
      const { extractText: extractPdf, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractPdf(pdf, { mergePages: true });
      return (Array.isArray(text) ? text.join("\n\n") : text).trim();
    }
    if (name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer });
      return value.trim();
    }
    if (TEXT_EXTENSIONS.test(name) || contentType?.startsWith("text/")) {
      return buffer.toString("utf-8").trim();
    }
  } catch (err) {
    console.warn(`Não foi possível extrair texto de ${fileName}:`, (err as Error).message);
  }
  return null;
}

export interface RegisterUploadInput {
  name: string;
  blob_url: string;
  content_type?: string | null;
  size_bytes?: number | null;
  category?: string;
  description?: string | null;
  created_by?: string;
}

/** Registra um arquivo que o navegador já enviou ao Blob e extrai o texto dele. */
export async function registerUploadedFile(input: RegisterUploadInput): Promise<FileRow> {
  if (!input.blob_url || !input.name) throw new FileInputError("name e blob_url são obrigatórios.");
  const res = await fetch(input.blob_url);
  if (!res.ok) throw new FileInputError(`Não foi possível ler o arquivo enviado (status ${res.status}).`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const text = await extractText(buffer, input.name, input.content_type);

  const row = await queryOne<FileRow>(
    `insert into files (name, category, description, blob_url, content_type, size_bytes, text_content, source, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, 'upload', $8)
     returning *`,
    [
      input.name,
      input.category || "outro",
      input.description ?? null,
      input.blob_url,
      input.content_type ?? null,
      input.size_bytes ?? buffer.byteLength,
      text,
      input.created_by ?? "pedro",
    ]
  );
  if (!row) throw new Error("Falha ao registrar arquivo.");
  return row;
}

export interface CreateTextFileInput {
  name: string;
  text: string;
  category?: string;
  description?: string | null;
  source?: "upload" | "claude_code";
  created_by?: string;
}

/** Cria um arquivo a partir de texto (colado no painel ou enviado pelo Claude). */
export async function createTextFile(input: CreateTextFileInput): Promise<FileRow> {
  if (!input.name?.trim() || !input.text?.trim()) throw new FileInputError("name e text são obrigatórios.");
  const fileName = /\.[a-z0-9]{2,5}$/i.test(input.name) ? input.name : `${input.name}.txt`;

  let blobUrl: string | null = null;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`biblioteca/${fileName}`, input.text, {
      access: "public",
      addRandomSuffix: true,
      contentType: "text/plain; charset=utf-8",
    });
    blobUrl = blob.url;
  }

  const row = await queryOne<FileRow>(
    `insert into files (name, category, description, blob_url, content_type, size_bytes, text_content, source, created_by)
     values ($1, $2, $3, $4, 'text/plain', $5, $6, $7, $8)
     returning *`,
    [
      fileName,
      input.category || "outro",
      input.description ?? null,
      blobUrl,
      Buffer.byteLength(input.text, "utf-8"),
      input.text,
      input.source ?? "upload",
      input.created_by ?? "pedro",
    ]
  );
  if (!row) throw new Error("Falha ao criar arquivo.");
  return row;
}

export interface UpdateFileInput {
  name?: string;
  category?: string;
  description?: string | null;
  text_content?: string | null;
}

export async function updateFile(id: string, input: UpdateFileInput): Promise<FileRow | null> {
  return queryOne<FileRow>(
    `update files set
       name         = coalesce($2, name),
       category     = coalesce($3, category),
       description  = case when $4 then $5 else description end,
       text_content = case when $6 then $7 else text_content end
     where id = $1
     returning *`,
    [
      id,
      input.name ?? null,
      input.category ?? null,
      input.description !== undefined,
      input.description ?? null,
      input.text_content !== undefined,
      input.text_content ?? null,
    ]
  );
}

export async function deleteFile(id: string): Promise<boolean> {
  const row = await queryOne<{ blob_url: string | null }>(`delete from files where id = $1 returning blob_url`, [id]);
  if (!row) return false;
  if (row.blob_url && process.env.BLOB_READ_WRITE_TOKEN) {
    await del(row.blob_url).catch((err) => console.warn("Falha ao apagar do Blob:", err.message));
  }
  return true;
}
