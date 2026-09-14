"use client";

import { Tela } from "@/components/MetadinhaPreview";
import { AGENDA_CATS, type AgendaCat, type StudioScene } from "@/lib/studio/scenes";

const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/** A metadinha inteira: cada cena com a tela desenhada ao lado da instrução. */
export default function MetadinhaPage({ cenas }: { cenas: StudioScene[] }) {
  return (
    <ol className="space-y-3">
      {cenas.map((c, n) => (
        <li key={n} className="flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white/80 p-4 sm:flex-row">
          <div className="sm:w-72 sm:shrink-0">
            <Tela cena={c} />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded bg-ink-900 px-1.5 py-0.5 font-mono text-[10.5px] text-gold-200">
                {c.inicio ? `${c.inicio}${c.fim ? `–${c.fim}` : ""}` : `cena ${n + 1}`}
              </span>
              <span className="font-semibold text-ink-800">{c.titulo ?? c.tipo}</span>
              <span className="text-ink-400">· {c.tipo}</span>
            </div>
            {c.linhas?.length ? (
              <div className="text-sm text-ink-700">
                <span className="text-[11px] uppercase tracking-wide text-gold-600">Texto na tela</span>
                <div className="mt-0.5 space-y-0.5">
                  {c.linhas.map((l, i) => (
                    <div key={i}>
                      “{l.txt}” <span className="text-[10.5px] text-ink-400">{l.papel}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {c.agenda && (
              <div className="text-sm text-ink-700">
                <span className="text-[11px] uppercase tracking-wide text-gold-600">Agenda</span>
                <div className="mt-0.5 text-xs text-ink-600">
                  {c.agenda.recorte === "dia" ? `um dia (${DIAS[c.agenda.dia ?? 0]})` : "semana"}
                  {c.agenda.h0 != null && ` · ${c.agenda.h0}h às ${c.agenda.h1 ?? 24}h`}
                  {c.agenda.modelo && ` · modelo “${c.agenda.modelo}”`}
                  {c.agenda.titulo && ` · título “${c.agenda.titulo}”`}
                  {c.agenda.nivel != null && ` · nível ${c.agenda.nivel}`}
                  {c.agenda.blocos?.length ? ` · ${c.agenda.blocos.length} blocos (${resumo(c.agenda.blocos)})` : ""}
                  {c.agenda.etapas?.length ? (
                    <div>Revelação: {c.agenda.etapas.map((e) => e.nome).join(" → ")}</div>
                  ) : null}
                </div>
              </div>
            )}
            {c.sono && (
              <div className="text-xs text-ink-600">
                Conta do sono · acorda {c.sono.acorda}, {c.sono.horas ?? 8}h de sono
              </div>
            )}
            {c.fala && <div className="text-sm text-ink-600">Fala: “{c.fala}”</div>}
            {c.instrucao && <div className="text-sm font-medium text-gold-700">▸ {c.instrucao}</div>}
            {c.nota && <div className="text-xs text-amber-700">⚠ Fora do estúdio: {c.nota}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function resumo(blocos: { cat: AgendaCat }[]) {
  const contagem = new Map<string, number>();
  for (const b of blocos) contagem.set(b.cat, (contagem.get(b.cat) ?? 0) + 1);
  return Array.from(contagem.entries())
    .map(([cat, n]) => `${n}× ${(AGENDA_CATS[cat as AgendaCat] ?? cat).split(" (")[0]}`)
    .join(", ");
}
