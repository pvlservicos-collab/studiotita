"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, ProgressBar } from "@/components/ui";
import MetadinhaPreview, { Tela } from "@/components/MetadinhaPreview";
import { AGENDA_CATS, type AgendaCat, type StudioScene } from "@/lib/studio/scenes";
import type { StudioFlowRow } from "@/lib/types";

const TIPO_LABEL: Record<string, string> = {
  texto: "Texto",
  numero: "Número grande",
  pergunta: "Pergunta",
  lista: "Lista",
  agenda: "Agenda",
  pentagono: "Pentágono 168h",
  sono: "Conta do sono",
  mapa: "Mapa mental",
  grafico: "Gráfico",
  metas: "Metas",
  imagem: "Imagem importada",
  chamada: "Chamada final",
};

/**
 * A metadinha do Estúdio Reels de uma análise: o esquema de telas que o
 * sistema montou para este vídeo, com botão para abrir no estúdio.
 */
export default function StudioFlowCard({ analysisId, videoId }: { analysisId: string; videoId: string }) {
  const [flow, setFlow] = useState<StudioFlowRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [escolhida, setEscolhida] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/studio-flows?analysis_id=${analysisId}`);
      const data = await res.json();
      setFlow(data.flow ?? null);
      return data.flow as StudioFlowRow | null;
    } finally {
      setLoading(false);
    }
  }, [analysisId]);

  // enquanto o Gemini monta, recarrega de tempos em tempos
  useEffect(() => {
    let vivo = true;
    const tick = async () => {
      const f = await load();
      if (!vivo) return;
      if (f && (f.status === "pending" || f.status === "processing")) timer.current = setTimeout(tick, 5000);
    };
    tick();
    return () => {
      vivo = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  async function gerar() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio-flows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ analysis_id: analysisId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao montar a metadinha.");
      setFlow(data.flow);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function baixar() {
    if (!flow) return;
    const res = await fetch(`/api/studio-flows/${flow.id}?formato=estudio`);
    const projeto = await res.json();
    const url = URL.createObjectURL(new Blob([JSON.stringify(projeto)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${flow.title.replace(/[^\w\d\-. ]+/g, "").slice(0, 60) || "metadinha"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cenas = (flow?.scenes as StudioScene[] | null) ?? [];
  const travado =
    flow?.status === "processing" && Date.now() - new Date(flow.created_at).getTime() > 10 * 60 * 1000;

  return (
    <section className="rounded-xl border border-gold-200 bg-gold-50/40 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-ink-900">Metadinha no Estúdio Reels</h3>
          <Badge tone="gold">✦ montada pelo sistema</Badge>
          <span className="text-[11px] text-ink-400">as telas da metade de baixo, cena por cena</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {flow?.status === "done" && (
            <>
              <a
                href={`/estudio-reels.html?fluxo=${flow.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold rounded-lg px-3 py-1.5 text-xs font-semibold"
              >
                Abrir no Estúdio ↗
              </a>
              <a
                href={`/metadinha/${flow.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-50"
              >
                Página da metadinha ↗
              </a>
              <button onClick={baixar} className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-50">
                Baixar .json
              </button>
            </>
          )}
          <button
            onClick={gerar}
            disabled={busy || flow?.status === "processing" || flow?.status === "pending"}
            className="rounded-lg border border-gold-300 bg-white px-3 py-1.5 text-xs font-semibold text-gold-700 hover:bg-gold-50 disabled:opacity-50"
          >
            {busy ? "Montando..." : flow ? "Gerar de novo" : "Gerar metadinha"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-400">Carregando...</p>
      ) : !flow ? (
        <p className="text-sm text-ink-500">
          Esta análise não tem metadinha. Clique em <strong>Gerar metadinha</strong> para o sistema montar o esquema de telas com
          base nos fluxos que o Augusto já usou.
        </p>
      ) : flow.status === "error" || travado ? (
        <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          <strong>Não deu para montar:</strong> {flow.error_message || "a montagem não terminou (o servidor encerrou antes)."} Tente
          &quot;Gerar de novo&quot;.
        </div>
      ) : flow.status !== "done" ? (
        <div className="max-w-md space-y-2">
          <div className="text-xs text-ink-500">Montando as telas com base nos fluxos do Augusto...</div>
          <ProgressBar progress={0} indeterminate />
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="text-sm font-semibold text-ink-900">{flow.title}</div>
            {flow.summary && <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-600">{flow.summary}</p>}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="sm:w-64 sm:shrink-0">
              <Tela cena={cenas[Math.min(escolhida, cenas.length - 1)]} />
              <div className="mt-1 text-[11px] text-ink-500">
                Cena {Math.min(escolhida, cenas.length - 1) + 1} de {cenas.length} · prévia da metade de baixo do vídeo
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <MetadinhaPreview cenas={cenas} onEscolher={setEscolhida} />
            </div>
          </div>
          <ol className="space-y-2">
            {(aberto ? cenas : cenas.slice(0, 3)).map((c, n) => (
              <SceneRow key={n} cena={c} numero={n + 1} destacada={n === escolhida} onClick={() => setEscolhida(n)} />
            ))}
          </ol>
          {cenas.length > 3 && (
            <button onClick={() => setAberto((a) => !a)} className="text-xs font-medium text-gold-700 hover:underline">
              {aberto ? "Recolher" : `Ver as ${cenas.length} cenas`}
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </section>
  );
}

function SceneRow({
  cena,
  numero,
  destacada,
  onClick,
}: {
  cena: StudioScene;
  numero: number;
  destacada?: boolean;
  onClick?: () => void;
}) {
  const tempo = cena.inicio ? `${cena.inicio}${cena.fim ? `–${cena.fim}` : ""}` : `cena ${numero}`;
  const a = cena.agenda;
  return (
    <li
      onClick={onClick}
      className={`cursor-pointer rounded-lg border bg-white/80 p-3 transition ${destacada ? "border-gold-400 ring-1 ring-gold-200" : "border-ink-100 hover:border-gold-200"}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-ink-900 px-1.5 py-0.5 font-mono text-[10.5px] text-gold-200">{tempo}</span>
        <span className="font-semibold text-ink-800">{TIPO_LABEL[cena.tipo] ?? cena.tipo}</span>
        {cena.titulo && <span className="text-ink-500">· {cena.titulo}</span>}
      </div>
      {cena.linhas?.length ? (
        <div className="mt-1.5 space-y-0.5">
          {cena.linhas.map((l, i) => (
            <div key={i} className={`text-sm ${l.papel === "numero" ? "text-lg font-bold text-ink-900" : "text-ink-700"}`}>
              “{l.txt}”
              {l.papel && <span className="ml-1 text-[10.5px] text-ink-400">{l.papel}</span>}
            </div>
          ))}
        </div>
      ) : null}
      {a && (
        <div className="mt-1.5 text-xs text-ink-600">
          <strong>Agenda</strong> {a.recorte === "dia" ? `· um dia (${["seg", "ter", "qua", "qui", "sex", "sáb", "dom"][a.dia ?? 0]})` : "· semana"}
          {a.h0 != null && ` · ${a.h0}h às ${a.h1 ?? 24}h`}
          {a.titulo && ` · “${a.titulo}”`}
          {a.lista && " · com lista de atividades"}
          {a.nivel != null && ` · nível ${a.nivel}`}
          {a.blocos?.length ? ` · ${a.blocos.length} blocos (${catsResumo(a.blocos)})` : ""}
          {a.etapas?.length ? (
            <div className="mt-0.5">Revelação: {a.etapas.map((e) => e.nome).join(" → ")}</div>
          ) : null}
        </div>
      )}
      {cena.sono && (
        <div className="mt-1.5 text-xs text-ink-600">
          <strong>Conta do sono</strong> · acorda {cena.sono.acorda}, {cena.sono.horas ?? 8}h de sono
        </div>
      )}
      {cena.grafico && <div className="mt-1.5 text-xs text-ink-600"><strong>Gráfico</strong> · modelo {cena.grafico.qual}</div>}
      {cena.mapa?.nos?.length ? (
        <div className="mt-1.5 text-xs text-ink-600">
          <strong>Mapa mental</strong> · {cena.mapa.nos.map((n) => n.txt).join(" / ")}
        </div>
      ) : null}
      {cena.fala && <div className="mt-1.5 text-xs text-ink-500">Fala: “{cena.fala}”</div>}
      {cena.instrucao && <div className="mt-0.5 text-xs text-gold-700">▸ {cena.instrucao}</div>}
      {cena.nota && <div className="mt-0.5 text-xs text-amber-700">⚠ Fora do estúdio: {cena.nota}</div>}
    </li>
  );
}

function catsResumo(blocos: { cat: AgendaCat }[]) {
  const contagem = new Map<string, number>();
  for (const b of blocos) contagem.set(b.cat, (contagem.get(b.cat) ?? 0) + 1);
  return Array.from(contagem.entries())
    .map(([cat, n]) => `${n}× ${(AGENDA_CATS[cat as AgendaCat] ?? cat).split(" (")[0]}`)
    .join(", ");
}
