"use client";

import { toStudioScene, type StudioScene } from "@/lib/studio/scenes";

/**
 * Prévia das telas da metadinha: cada cena desenhada como ela vai aparecer na
 * metade de baixo do vídeo (proporção 1080x960, fundo e cores do estúdio).
 *
 * O desenho sai do MESMO objeto que o estúdio abre (toStudioScene), então o
 * que aparece aqui é o que o estúdio vai mostrar — de forma simplificada nos
 * widgets (agenda, sono, pentágono, gráfico, mapa e metas).
 */

const BG = "#2E2E2E";
const INK = "#EDEAE5";
const DIM = "#8E8A84";

const CAT_COR: Record<string, string> = {
  f1: "#8474EB",
  f2: "#FFA25A",
  prazo: "#F28B82",
  f3: "#73E294",
  desvio: "#FADD69",
  vaz: "#D9D5FF",
  cel: "#BDBDB7",
  sono: "#2F2F29",
};

const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

export default function MetadinhaPreview({
  cenas,
  atual,
  onEscolher,
}: {
  cenas: StudioScene[];
  /** índice da cena em destaque (quando não vier, mostra todas em fila) */
  atual?: number;
  onEscolher?: (n: number) => void;
}) {
  if (!cenas?.length) return null;
  if (atual != null) return <Tela cena={cenas[atual]} />;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {cenas.map((c, n) => (
        <button
          key={n}
          onClick={() => onEscolher?.(n)}
          className="w-40 shrink-0 text-left"
          title={`${c.inicio ?? ""} ${c.titulo ?? ""}`}
        >
          <Tela cena={c} />
          <div className="mt-1 truncate text-[10px] text-ink-500">
            {c.inicio ? `${c.inicio} · ` : ""}
            {c.titulo ?? c.tipo}
          </div>
        </button>
      ))}
    </div>
  );
}

/** Uma tela: a metade de baixo do vídeo, na proporção 1080x960. */
export function Tela({ cena }: { cena: StudioScene }) {
  const c = toStudioScene(cena) as any;
  return (
    <div
      className="relative w-full overflow-hidden rounded-md ring-1 ring-black/20"
      style={{
        aspectRatio: "1080 / 960",
        background: BG,
        color: INK,
        containerType: "inline-size",
        fontFamily: "Lato, Inter, system-ui, sans-serif",
      }}
    >
      {c.tipo === "agenda" ? (
        <Agenda c={c} />
      ) : c.tipo === "sono" ? (
        <Sono c={c} />
      ) : c.tipo === "pentagono" ? (
        <Pentagono />
      ) : c.tipo === "grafico" ? (
        <Grafico qual={c.graf?.qual ?? 2} />
      ) : c.tipo === "metas" ? (
        <Metas />
      ) : c.tipo === "mapa" ? (
        <Mapa c={c} />
      ) : (
        <Texto c={c} />
      )}
      {cena.nota && (
        <span
          className="absolute right-1 top-1 rounded bg-amber-500/90 px-1 text-[9px] font-semibold text-ink-900"
          title={cena.nota}
        >
          fora do estúdio
        </span>
      )}
    </div>
  );
}

/** Escala igual à do estúdio: font-size = tam * (largura / 1080). */
const fonte = (tam: number) => `calc(${tam} / 1080 * 100cqw)`;

function Texto({ c }: { c: any }) {
  return (
    <>
      {(c.blocos ?? []).map((b: any, k: number) => (
        <div
          key={k}
          className="absolute whitespace-pre-wrap leading-tight"
          style={{
            left: `${(b.x * 100).toFixed(2)}%`,
            top: `${(b.y * 100).toFixed(2)}%`,
            width: b.al === "center" ? "76%" : b.larg ? `${b.larg}%` : "82%",
            fontSize: fonte(b.tam || 30),
            fontWeight: b.neg ? 700 : 300,
            fontStyle: b.ita ? "italic" : "normal",
            textAlign: b.al || "left",
            color: b.cor || INK,
            ...(b.fundo ? { background: b.fundo, padding: ".35em .7em", margin: "-.35em -.7em", color: "#191919" } : {}),
          }}
        >
          {b.txt}
        </div>
      ))}
    </>
  );
}

function Agenda({ c }: { c: any }) {
  const aj = c.aj ?? {};
  const h0 = aj.h0 ?? 5;
  const h1 = aj.h1 ?? 24;
  const total = Math.max(1, (h1 - h0) * 60);
  const umDia = aj.dia != null;
  const dias = umDia ? [aj.dia] : [0, 1, 2, 3, 4, 5, 6];
  const blocos = (c.agb ?? []).filter((b: any) => !umDia || b.dia === aj.dia);

  return (
    <div className="absolute inset-0 flex flex-col p-[3%]">
      <div className="mb-[1.5%] truncate" style={{ fontSize: fonte(30), color: INK, fontWeight: 600 }}>
        {c.agTit || "Agenda da semana"}
      </div>
      <div className="relative flex flex-1 gap-[1%]">
        {dias.map((d) => (
          <div key={d} className="relative flex-1 rounded-sm" style={{ background: "rgba(255,255,255,.04)" }}>
            <div className="absolute inset-x-0 top-0 text-center" style={{ fontSize: fonte(18), color: DIM }}>
              {DIAS[d]}
            </div>
            {blocos
              .filter((b: any) => b.dia === d)
              .map((b: any, k: number) => {
                const topo = ((b.ini - h0 * 60) / total) * 100;
                const alt = (b.dur / total) * 100;
                if (topo > 100 || topo + alt < 0) return null;
                return (
                  <div
                    key={k}
                    className="absolute inset-x-[4%] overflow-hidden rounded-[2px] px-[3%]"
                    style={{
                      top: `${Math.max(6, topo)}%`,
                      height: `${Math.max(1.2, alt)}%`,
                      background: CAT_COR[b.cat] ?? CAT_COR.vaz,
                      color: b.cat === "sono" ? "#FFFFFF" : "#191919",
                      fontSize: fonte(14),
                      lineHeight: 1.05,
                    }}
                  >
                    {alt > 3.5 ? b.rot : ""}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Sono({ c }: { c: any }) {
  const acorda = c.sono?.acorda ?? 420;
  const dur = c.sono?.dur ?? 480;
  const hh = (m: number) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const marcas = [
    { rot: "alarme", min: acorda - dur - 15 - 60, cor: "#FADD69" },
    { rot: "deitar", min: acorda - dur - 15, cor: INK },
    { rot: "pega no sono", min: acorda - dur, cor: "#73E294" },
    { rot: "acordar", min: acorda, cor: INK },
  ];
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-[6%] p-[8%]">
      <div style={{ fontSize: fonte(30), color: DIM }}>Que horas ir pra cama?</div>
      <div className="relative h-[12%] rounded-full" style={{ background: "rgba(255,255,255,.08)" }}>
        {marcas.map((m, k) => (
          <div key={k} className="absolute top-0 h-full" style={{ left: `${(k / (marcas.length - 1)) * 92 + 2}%` }}>
            <div className="h-full w-[3px] rounded" style={{ background: m.cor }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        {marcas.map((m, k) => (
          <div key={k} className="text-center" style={{ width: "24%" }}>
            <div style={{ fontSize: fonte(26), fontWeight: 700 }}>{hh(m.min)}</div>
            <div style={{ fontSize: fonte(16), color: DIM }}>{m.rot}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PENT_AREAS = [
  { nome: "Trabalho", cor: "#E0A458", valor: 60 },
  { nome: "Lazer", cor: "#7FB685", valor: 6 },
  { nome: "Aleatórias", cor: "#9B8AC4", valor: 10 },
  { nome: "Família", cor: "#C9748A", valor: 14 },
  { nome: "Saúde", cor: "#73E294", valor: 78 },
];

function Pentagono() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative aspect-square h-[86%]">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <polygon points="50,4 96,38 78,94 22,94 4,38" fill="rgba(224,164,88,.18)" stroke={DIM} strokeWidth="0.7" />
        </svg>
        {PENT_AREAS.map((a, k) => {
          const pos = [
            { left: "50%", top: "2%" },
            { left: "88%", top: "38%" },
            { left: "74%", top: "88%" },
            { left: "26%", top: "88%" },
            { left: "12%", top: "38%" },
          ][k];
          return (
            <div key={a.nome} className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={pos}>
              <div style={{ fontSize: fonte(26), fontWeight: 700, color: a.cor }}>{a.valor}h</div>
              <div style={{ fontSize: fonte(16), color: DIM }}>{a.nome}</div>
            </div>
          );
        })}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div style={{ fontSize: fonte(34), fontWeight: 700 }}>168h</div>
          <div style={{ fontSize: fonte(16), color: DIM }}>na semana</div>
        </div>
      </div>
    </div>
  );
}

function Grafico({ qual }: { qual: number }) {
  const linhas =
    qual === 1
      ? [
          { d: "M10,70 L80,70", cor: "#A9C4F5", rot: "musculação 100%" },
          { d: "M10,85 L52,85", cor: "#73E294", rot: "jiu-jitsu 60%" },
        ]
      : qual === 3
      ? [
          { d: "M10,90 C30,70 40,40 60,25 L90,20", cor: "#F06060", rot: "rotina que não gosta" },
          { d: "M10,90 C40,80 60,60 90,35", cor: "#73E294", rot: "rotina que gosta" },
        ]
      : [
          { d: "M10,90 C30,60 55,35 90,18", cor: DIM, rot: "ideal (robô)" },
          { d: "M10,90 C25,60 35,80 55,88 C70,92 80,80 90,78", cor: "#F06060", rot: "arranca e desiste" },
          { d: "M10,90 C35,78 60,60 90,42", cor: "#73E294", rot: "constante" },
        ];
  return (
    <div className="absolute inset-0 p-[6%]">
      <svg viewBox="0 0 100 100" className="h-[78%] w-full">
        <line x1="10" y1="95" x2="95" y2="95" stroke={DIM} strokeWidth="0.6" />
        <line x1="10" y1="95" x2="10" y2="10" stroke={DIM} strokeWidth="0.6" />
        {linhas.map((l, k) => (
          <path key={k} d={l.d} fill="none" stroke={l.cor} strokeWidth="1.6" strokeDasharray={k === 0 && qual === 2 ? "3 2" : undefined} />
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-[4%]">
        {linhas.map((l) => (
          <span key={l.rot} style={{ fontSize: fonte(16), color: l.cor }}>
            ● {l.rot}
          </span>
        ))}
      </div>
    </div>
  );
}

function Metas() {
  const cards = [
    { rot: "Financeiro", meta: "R$ 50 mil/mês", data: "até dez/2026" },
    { rot: "Saúde", meta: "82 kg, 15% gordura", data: "até jun/2026" },
    { rot: "Relacionamentos", meta: "10 eventos", data: "até dez/2026" },
  ];
  return (
    <div className="absolute inset-0 flex items-center gap-[3%] p-[6%]">
      {cards.map((c) => (
        <div key={c.rot} className="flex-1 rounded-md p-[6%]" style={{ background: "rgba(255,255,255,.06)" }}>
          <div style={{ fontSize: fonte(20), color: DIM }}>{c.rot}</div>
          <div style={{ fontSize: fonte(22), fontWeight: 700 }}>{c.meta}</div>
          <div style={{ fontSize: fonte(16), color: "#73E294" }}>{c.data}</div>
        </div>
      ))}
    </div>
  );
}

function Mapa({ c }: { c: any }) {
  const nos = (c.mapa?.nos ?? []).slice(0, 7);
  return (
    <div className="absolute inset-0 p-[6%]">
      {nos.map((n: any, k: number) => (
        <div
          key={k}
          className="absolute rounded-md px-[1.5%] py-[1%]"
          style={{
            left: `${n.x ?? 10 + (k % 3) * 30}%`,
            top: `${n.y ?? 12 + Math.floor(k / 3) * 26}%`,
            background: n.tipo === "central" ? "rgba(224,140,58,.25)" : "rgba(255,255,255,.08)",
            fontSize: fonte(n.tipo === "central" ? 24 : 18),
            maxWidth: "40%",
          }}
        >
          {n.txt}
        </div>
      ))}
    </div>
  );
}
