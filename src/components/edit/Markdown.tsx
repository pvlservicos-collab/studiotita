"use client";

import { Fragment, type ReactNode } from "react";

/**
 * Markdown leve para as notas da Biblioteca de Edição: títulos, listas,
 * citações, tabelas, blocos de código (com botão copiar) e [[links]] entre notas.
 */
function inline(text: string, onLink: (slug: string) => void, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\*\*([^*]+)\*\*|`([^`]+)`|_([^_]+)_|\*([^*]+)\*|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[2]) {
      const slug = m[2].trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      out.push(
        <button key={k} onClick={() => onLink(slug)} className="rounded bg-gold-100 px-1 font-medium text-gold-700 hover:bg-gold-200">
          {m[3] || m[2]}
        </button>
      );
    } else if (m[4]) out.push(<strong key={k} className="font-semibold text-ink-900">{m[4]}</strong>);
    else if (m[5]) out.push(<code key={k} className="rounded bg-ink-100 px-1 py-0.5 text-[0.85em] text-ink-800">{m[5]}</code>);
    else if (m[6] || m[7]) out.push(<em key={k}>{m[6] || m[7]}</em>);
    else out.push(<a key={k} href={m[0]} target="_blank" rel="noreferrer" className="break-all text-gold-700 underline">{m[0]}</a>);
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  return (
    <div className="relative my-3 overflow-hidden rounded-xl border border-ink-200 bg-ink-900 text-ink-50">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[11px] uppercase tracking-wider text-ink-300">
        <span>{lang === "prompt" ? "Prompt pronto" : lang || "código"}</span>
        <button onClick={() => navigator.clipboard.writeText(code)} className="rounded-full bg-white/10 px-3 py-0.5 normal-case tracking-normal text-gold-200 hover:bg-white/20">
          Copiar
        </button>
      </div>
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap p-4 text-[13px] leading-relaxed">{code}</pre>
    </div>
  );
}

export default function Markdown({ md, onLink }: { md: string; onLink: (slug: string) => void }) {
  const lines = md.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let n = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${n++}`;
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      blocks.push(<CodeBlock key={key} code={buf.join("\n")} lang={lang} />);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      const size = ["text-xl", "text-lg", "text-base", "text-sm"][h[1].length - 1];
      blocks.push(<div key={key} className={`${size} mb-2 mt-5 font-semibold tracking-tight text-ink-900`}>{inline(h[2], onLink, key)}</div>);
      i++;
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        if (!/^\|[\s:-|]+\|$/.test(lines[i])) rows.push(lines[i].split("|").slice(1, -1).map((c) => c.trim()));
        i++;
      }
      blocks.push(
        <div key={key} className="my-3 overflow-x-auto rounded-xl border border-ink-100">
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className={ri === 0 ? "bg-ink-50 font-semibold" : "border-t border-ink-100"}>
                  {r.map((c, ci) => <td key={ci} className="px-3 py-1.5 align-top">{inline(c, onLink, `${key}-${ri}-${ci}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: { text: string; check?: boolean | null }[] = [];
      const ordered = /^\s*\d+\./.test(line);
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        let t = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, "");
        let check: boolean | null = null;
        const c = t.match(/^\[( |x)\]\s*/i);
        if (c) {
          check = c[1].toLowerCase() === "x";
          t = t.slice(c[0].length);
        }
        items.push({ text: t, check });
        i++;
      }
      const Tag = ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={key} className={`my-2 space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"} marker:text-gold-500`}>
          {items.map((it, ii) => (
            <li key={ii}>
              {it.check !== null && it.check !== undefined ? <span className="mr-1">{it.check ? "☑" : "☐"}</span> : null}
              {inline(it.text, onLink, `${key}-${ii}`)}
            </li>
          ))}
        </Tag>
      );
      continue;
    }
    if (line.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) buf.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(
        <blockquote key={key} className="my-3 border-l-4 border-gold-400 bg-gold-50/60 px-4 py-2 text-ink-700">
          {buf.map((b, bi) => <Fragment key={bi}>{inline(b, onLink, `${key}-${bi}`)}{bi < buf.length - 1 && <br />}</Fragment>)}
        </blockquote>
      );
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const buf: string[] = [lines[i++]];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\||>|\s*([-*]|\d+\.)\s)/.test(lines[i])) buf.push(lines[i++]);
    blocks.push(<p key={key} className="my-2 leading-relaxed text-ink-700">{inline(buf.join(" "), onLink, key)}</p>);
  }
  return <div className="text-[15px]">{blocks}</div>;
}
