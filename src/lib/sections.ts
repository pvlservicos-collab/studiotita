/**
 * Divide o texto de um arquivo da biblioteca em seções com título, para o
 * Claude poder pedir uma parte específica (um roteiro antigo, um tema de
 * aula) em vez do documento inteiro.
 *
 *  - Markdown: títulos # / ## / ###.
 *  - Texto extraído de PDF: linha curta que começa um bloco (a anterior
 *    terminou a frase) e não é fala entre aspas. Nas Bases de Ensino, títulos
 *    com "[S01]" são passagens (nível 2) dentro de um tema (nível 1).
 *  - Sem títulos detectáveis: partes de tamanho fixo.
 */

export interface Section {
  level: number;
  title: string;
  content: string;
}

const MAX_SECTION_CHARS = 20_000;
const MIN_SECTION_CHARS = 120;
const CHUNK_CHARS = 8_000;

function splitMarkdown(text: string): Section[] | null {
  const lines = text.split(/\r?\n/);
  if (!lines.some((l) => /^#{1,3}\s+\S/.test(l))) return null;
  const sections: Section[] = [];
  let current: Section = { level: 1, title: "Início", content: "" };
  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+?)\s*#*$/);
    if (m) {
      sections.push(current);
      current = { level: m[1].length, title: m[2].trim(), content: "" };
    } else {
      current.content += `${line}\n`;
    }
  }
  sections.push(current);
  return sections;
}

const ENDS_BLOCK = /[.!?”"\])»:]\s*$/;
const STARTS_QUOTE = /^[“"«(\-–—•*\d]/;

function looksLikeTitle(line: string, prev: string | undefined) {
  const t = line.trim();
  if (t.length < 3 || t.length > 100) return false;
  if (STARTS_QUOTE.test(t) || /[”"]\s*$/.test(t) || /[,;]$/.test(t)) return false;
  if (!/^[A-ZÀ-Ý]/.test(t)) return false;
  // a linha anterior precisa ter fechado a frase (senão é continuação de parágrafo quebrado)
  if (prev !== undefined && prev.trim() !== "" && !ENDS_BLOCK.test(prev)) return false;
  // títulos são frases curtas: poucas palavras e no máximo um ponto final
  const words = t.split(/\s+/).length;
  if (words > 16) return false;
  if ((t.match(/\.\s/g) ?? []).length > 1) return false;
  return true;
}

function splitPlainText(text: string): Section[] | null {
  const lines = text.split(/\r?\n/);
  const sections: Section[] = [];
  let current: Section = { level: 1, title: "Início", content: "" };
  let prev: string | undefined;
  let titles = 0;
  for (const line of lines) {
    if (looksLikeTitle(line, prev)) {
      sections.push(current);
      const title = line.trim();
      current = { level: /\[S\d+\]/.test(title) ? 2 : 1, title, content: "" };
      titles++;
    } else {
      current.content += `${line}\n`;
    }
    if (line.trim() !== "") prev = line;
  }
  sections.push(current);
  // Poucos títulos para o tamanho do texto = heurística não se aplica (ex.: artigo científico corrido).
  if (titles < 3) return null;
  return sections;
}

const ATTRIBUTION = /^\s*[—–-]\s*(S\d+[^\n]*)$/;

/**
 * Corpus das Bases de Ensino: falas entre aspas, cada uma fechada por uma
 * linha "— S01". Cada fala vira uma seção (nível 2) dentro do tema.
 */
function splitPassages(section: Section): Section[] {
  const lines = section.content.split("\n");
  if (lines.filter((l) => ATTRIBUTION.test(l)).length < 3) return [section];

  const out: Section[] = [{ ...section, content: "" }];
  let buffer: string[] = [];
  for (const line of lines) {
    const m = line.match(ATTRIBUTION);
    if (!m) {
      buffer.push(line);
      continue;
    }
    const text = buffer.join("\n").trim();
    buffer = [];
    if (!text) continue;
    const firstWords = text.replace(/^[“"]/, "").replace(/\s+/g, " ").slice(0, 70).replace(/\s\S*$/, "");
    out.push({ level: section.level + 1, title: `“${firstWords}…” — ${m[1].trim()}`, content: `${text}\n— ${m[1].trim()}` });
  }
  const rest = buffer.join("\n").trim();
  if (rest) out[out.length - 1].content += `\n${rest}`;
  if (!out[0].content.trim()) out[0].content = `${out.length - 1} passagens neste tema.`;
  return out;
}

function chunk(text: string, baseTitle: string): Section[] {
  const parts: Section[] = [];
  let rest = text;
  let n = 1;
  while (rest.length > 0) {
    let cut = Math.min(CHUNK_CHARS, rest.length);
    if (cut < rest.length) {
      const para = rest.lastIndexOf("\n\n", cut);
      const line = rest.lastIndexOf("\n", cut);
      cut = para > CHUNK_CHARS * 0.5 ? para : line > CHUNK_CHARS * 0.5 ? line : cut;
    }
    parts.push({ level: 1, title: `${baseTitle} · parte ${n++}`, content: rest.slice(0, cut) });
    rest = rest.slice(cut);
  }
  return parts;
}

/** mode "chunks": artigos científicos e textos corridos, onde títulos detectados seriam ruído. */
export function splitIntoSections(text: string, fileName: string, mode: "auto" | "chunks" = "auto"): Section[] {
  if (!text?.trim()) return [];
  const baseTitle = fileName.replace(/\.[^.]+$/, "");
  if (mode === "chunks") return chunk(text.trim(), baseTitle);
  const isMarkdown = /\.(md|markdown)$/i.test(fileName);
  let sections = (isMarkdown ? splitMarkdown(text) : null) ?? splitPlainText(text) ?? chunk(text, baseTitle);

  // limpa e junta seções minúsculas na anterior (título solto sem conteúdo)
  const merged: Section[] = [];
  for (const s of sections) {
    const content = s.content.replace(/\n{3,}/g, "\n\n").trim();
    if (!content && merged.length) {
      merged[merged.length - 1].content += `\n${s.title}`;
      continue;
    }
    if (content.length < MIN_SECTION_CHARS && merged.length && s.level >= merged[merged.length - 1].level) {
      merged[merged.length - 1].content += `\n\n${s.title}\n${content}`;
      continue;
    }
    merged.push({ ...s, content });
  }
  if (merged[0]?.title === "Início" && !merged[0].content) merged.shift();

  // falas com "— S01" viram passagens; o que ainda for gigante é quebrado em partes
  sections = merged
    .flatMap(splitPassages)
    .flatMap((s) => (s.content.length > MAX_SECTION_CHARS ? chunk(s.content, s.title).map((p) => ({ ...p, level: s.level })) : [s]));
  return sections;
}
