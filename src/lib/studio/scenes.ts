/**
 * O formato das cenas do Estúdio Reels dentro do app (StudioScene) e a
 * conversão para o formato de PROJETO do estúdio (public/estudio-reels.html),
 * que é o que o estúdio abre.
 *
 * Uma "metadinha" é o vídeo em que o Augusto aparece em cima e a tela do
 * estúdio ocupa a metade de baixo do quadro (o palco do estúdio tem
 * exatamente a proporção 1080x960 dessa metade). Um "fluxo" é a sequência
 * de telas dessa metade de baixo, cena por cena, junto com a instrução de
 * fala de cada uma.
 */

/** Categorias da agenda — as mesmas cores/nomes do estúdio e do método. */
export const AGENDA_CATS = {
  f1: "Prioridades (roxo)",
  f2: "Reunião (laranja)",
  prazo: "Prazo (vermelho claro)",
  f3: "Treino e refeições (verde)",
  desvio: "Coringa (amarelo)",
  vaz: "Atividade (lilás)",
  cel: "Celular (cinza)",
  sono: "Dormir (cinza escuro)",
} as const;

export type AgendaCat = keyof typeof AGENDA_CATS;

export const AGENDA_CAT_IDS = Object.keys(AGENDA_CATS) as AgendaCat[];

/** Tipos de cena que o app usa. Os que não existem no estúdio viram tela de texto com uma nota. */
export const SCENE_TYPES = [
  "texto", // frase curta
  "numero", // um número gigante em destaque
  "pergunta", // pergunta direta centralizada
  "lista", // título + 3 a 5 itens
  "agenda", // agenda da semana (ou de um dia) pintada nas categorias
  "pentagono", // as 168 horas divididas em 5 áreas
  "sono", // a conta do sono (acordar → 8h → deitar → alarme)
  "mapa", // mapa mental
  "grafico", // gráfico animado
  "metas", // 3 cards de meta + plano de ação
  "imagem", // ilustração/print entrando na tela (o arquivo é importado à mão)
  "chamada", // chamada final ("Comenta 247")
] as const;

export type SceneType = (typeof SCENE_TYPES)[number];

/** Papel de cada linha de texto na tela — define tamanho, cor e peso. */
export const LINE_ROLES = ["apoio", "destaque", "numero", "frase", "item", "titulo"] as const;
export type LineRole = (typeof LINE_ROLES)[number];

export interface SceneLine {
  txt: string;
  papel?: LineRole;
  cor?: string;
}

export interface SceneAgendaBlock {
  dia: number; // 0 = segunda ... 6 = domingo
  inicio: string; // "08:00"
  dur: number; // minutos
  cat: AgendaCat;
  rot: string; // o texto que aparece no bloco
  /** nível em que o bloco aparece (agenda em níveis, como nos "7 níveis") */
  nv?: number;
  nvFim?: number;
}

export interface SceneAgenda {
  /** "semana" (padrão) ou "dia" — recorta um dia só */
  recorte?: "semana" | "dia";
  dia?: number; // com recorte "dia": qual dia
  h0?: number; // primeira hora mostrada (padrão 5)
  h1?: number; // última hora mostrada (padrão 24)
  /** mostra a lista de atividades ao lado da agenda */
  lista?: boolean;
  /** modelo pronto do estúdio ("Semana do empresário", "Semana caótica"...) usado como base */
  modelo?: string;
  titulo?: string; // título em cima da agenda ("Agenda da semana · Nível 0 · sem organização")
  blocos: SceneAgendaBlock[];
  /** revelação em etapas: cada etapa acende as categorias que ela lista */
  etapas?: { nome: string; cats?: AgendaCat[] }[];
  /** agenda em níveis: nível mostrado nesta cena */
  nivel?: number;
}

export interface StudioScene {
  inicio?: string; // "00:00" — tempo do vídeo
  fim?: string; // "00:12"
  tipo: SceneType;
  titulo?: string; // nome da cena na fita do roteiro
  linhas?: SceneLine[]; // o texto que aparece na tela
  agenda?: SceneAgenda;
  sono?: { acorda: string; horas?: number };
  grafico?: { qual: 1 | 2 | 3 }; // 1 = barras por treino, 2 = constância ao longo dos meses, 3 = rotina rápida x lenta
  mapa?: { nos: { tipo?: string; txt: string; x?: number; y?: number }[]; setas?: [number, number][] };
  fala?: string; // o que o Augusto fala nesse trecho
  instrucao?: string; // ritmo, pausa, onde apontar, o que desenhar com a caneta
  /** o que esta cena exige fora do estúdio (print, gravação de tela, ilustração) */
  nota?: string;
}

export interface StudioFlowContent {
  titulo: string;
  resumo?: string;
  cenas: StudioScene[];
}

// ---------------------------------------------------------------- helpers

const CORES = {
  cinza: "#8E8A84",
  laranja: "#E08C3A",
  verde: "#73E294",
  roxo: "#9B8AC4",
  vermelho: "#F06060",
  claro: "#EDEAE5",
};

/** cores que se alternam nos itens de lista, como nas telas do Augusto */
const CORES_ITEM = [CORES.laranja, CORES.roxo, CORES.verde, CORES.laranja, CORES.roxo];

const TAMANHOS: Record<LineRole, number> = {
  numero: 96,
  destaque: 46,
  titulo: 38,
  apoio: 38,
  item: 30,
  frase: 26,
};

/** "08:30" (ou "8h30", "8") em minutos desde a meia-noite. */
export function hhmmToMin(value: string | number | undefined, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const m = /^\s*(\d{1,2})\s*[:hH]?\s*(\d{2})?/.exec(String(value ?? ""));
  if (!m) return fallback;
  const h = Math.min(23, Number(m[1] || 0));
  const min = Math.min(59, Number(m[2] || 0));
  return h * 60 + min;
}

function esc(txt: string) {
  return String(txt ?? "").trim();
}

/** Uma linha da instrução de fala que vai no campo "roteiro" da cena do estúdio. */
export function sceneRoteiro(s: StudioScene) {
  const tempo = s.inicio ? `[${s.inicio}${s.fim ? `–${s.fim}` : ""}] ` : "";
  return [
    `${tempo}${esc(s.fala ?? "")}`.trim(),
    esc(s.instrucao ?? ""),
    s.nota ? `⚠ ${esc(s.nota)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Empilha as linhas de texto dentro da zona segura da cena (x a partir de
 * 0.09, última linha terminando antes de 0.95), como nas telas do Augusto.
 */
function blocosDeTexto(linhas: SceneLine[], centralizado: boolean) {
  const alturaLinhas = (l: SceneLine) => (esc(l.txt).split("\n").length || 1);
  const total = linhas.reduce((soma, l) => {
    const tam = TAMANHOS[l.papel ?? "destaque"];
    return soma + (tam / 960) * 1.5 * alturaLinhas(l) + 0.045;
  }, 0);

  let y = Math.max(0.12, (1 - total) / 2);
  let itens = 0;
  return linhas.map((l) => {
    const papel = l.papel ?? "destaque";
    const tam = TAMANHOS[papel];
    const bloco: Record<string, unknown> = {
      x: centralizado ? 0.12 : 0.09,
      y: Number(y.toFixed(3)),
      txt: esc(l.txt),
      tam,
    };
    if (papel === "numero" || papel === "destaque" || papel === "titulo") bloco.neg = true;
    if (papel === "frase") bloco.ita = true;
    const cor = l.cor || (papel === "apoio" || papel === "frase" ? CORES.cinza : papel === "item" ? CORES_ITEM[itens % CORES_ITEM.length] : "");
    if (cor) bloco.cor = cor;
    if (centralizado) bloco.al = "center";
    if (papel === "item") itens++;
    y += (tam / 960) * 1.5 * alturaLinhas(l) + 0.045;
    return bloco;
  });
}

let proximoId = 1;

function blocosDaAgenda(agenda: SceneAgenda) {
  return (agenda.blocos ?? []).map((b) => {
    const bloco: Record<string, unknown> = {
      id: proximoId++,
      dia: Math.max(0, Math.min(6, Math.round(Number(b.dia) || 0))),
      ini: hhmmToMin(b.inicio, 8 * 60),
      dur: Math.max(15, Math.round(Number(b.dur) || 60)),
      cat: AGENDA_CAT_IDS.includes(b.cat) ? b.cat : "vaz",
      rot: esc(b.rot),
    };
    if (b.nv != null) bloco.nv = b.nv;
    if (b.nvFim != null) bloco.nvFim = b.nvFim;
    return bloco;
  });
}

/** Uma cena do app no formato de cena do estúdio. */
export function toStudioScene(s: StudioScene): Record<string, unknown> {
  const roteiro = sceneRoteiro(s);
  const titulo = esc(s.titulo ?? "");

  if (s.tipo === "agenda" && s.agenda) {
    const a = s.agenda;
    const aj: Record<string, unknown> = { esc: 1, dx: 0, dy: 0 };
    if (a.recorte === "dia") aj.dia = Math.max(0, Math.min(6, Math.round(Number(a.dia) || 0)));
    if (a.h0 != null) aj.h0 = a.h0;
    if (a.h1 != null) aj.h1 = a.h1;
    if (a.lista) aj.lista = true;
    const cena: Record<string, unknown> = {
      tipo: "agenda",
      titulo,
      roteiro,
      agb: blocosDaAgenda(a),
      age: (a.etapas ?? []).map((e) => ({ nome: esc(e.nome), cats: e.cats })),
      aj,
    };
    if (a.titulo) cena.agTit = esc(a.titulo);
    if (a.nivel != null) {
      cena.nvAtual = a.nivel;
      cena.nvBase = a.nivel;
    }
    return cena;
  }

  if (s.tipo === "sono") {
    return {
      tipo: "sono",
      titulo,
      roteiro,
      sono: { acorda: hhmmToMin(s.sono?.acorda, 7 * 60), dur: Math.round((s.sono?.horas ?? 8) * 60) },
    };
  }

  if (s.tipo === "grafico") {
    const qual = s.grafico?.qual === 1 || s.grafico?.qual === 3 ? s.grafico.qual : 2;
    return { tipo: "grafico", titulo, roteiro, graf: { qual, vel: 2.2 } };
  }

  if (s.tipo === "pentagono") return { tipo: "pentagono", titulo, roteiro };
  if (s.tipo === "metas") return { tipo: "metas", titulo, roteiro };

  if (s.tipo === "mapa") {
    const nos = (s.mapa?.nos ?? []).map((n, k) => ({
      id: k + 1,
      tipo: n.tipo ?? "nota",
      txt: esc(n.txt),
      x: n.x ?? 18 + (k % 3) * 28,
      y: n.y ?? 18 + Math.floor(k / 3) * 22,
    }));
    const setas = (s.mapa?.setas ?? []).map(([a, b]) => ({ a: a + 1, b: b + 1 }));
    return { tipo: "mapa", titulo, roteiro, mapa: { nos, setas } };
  }

  // texto, numero, pergunta, lista, imagem e chamada viram tela de texto
  const linhas = s.linhas?.length ? s.linhas : [{ txt: esc(s.titulo ?? ""), papel: "destaque" as LineRole }];
  return {
    tipo: "texto",
    titulo,
    roteiro,
    blocos: blocosDeTexto(linhas, s.tipo === "pergunta"),
    imagens: [],
  };
}

/**
 * O fluxo inteiro no formato de projeto do estúdio. É este JSON que
 * /estudio-reels.html?fluxo=<id> abre (e que o botão "Baixar .json" salva).
 */
export function toStudioProject(cenas: StudioScene[]) {
  proximoId = 1000;
  const c = (cenas ?? []).map(toStudioScene);
  return { c, t: c.map(() => []) };
}

/** O fluxo em texto, para mostrar no painel e para mandar ao Gemini como exemplo. */
export function flowToText(cenas: StudioScene[]) {
  return (cenas ?? [])
    .map((s, n) => {
      const tempo = s.inicio ? `[${s.inicio}${s.fim ? `–${s.fim}` : ""}]` : `[cena ${n + 1}]`;
      const partes = [`${tempo} ${s.tipo.toUpperCase()}${s.titulo ? ` · ${s.titulo}` : ""}`];
      if (s.linhas?.length) partes.push(`  tela: ${s.linhas.map((l) => `"${l.txt}"${l.papel ? ` (${l.papel})` : ""}`).join(" / ")}`);
      if (s.agenda) {
        const a = s.agenda;
        partes.push(
          `  agenda: ${a.recorte === "dia" ? `dia ${a.dia ?? 0}` : "semana"}${a.h0 != null ? ` ${a.h0}h-${a.h1 ?? 24}h` : ""}` +
            `${a.modelo ? ` · modelo "${a.modelo}"` : ""}` +
            `${a.titulo ? ` · "${a.titulo}"` : ""}${a.lista ? " · com lista de atividades" : ""}${a.nivel != null ? ` · nível ${a.nivel}` : ""}` +
            ` · ${a.blocos?.length ?? 0} blocos (${resumoCats(a.blocos ?? [])})` +
            (a.etapas?.length ? ` · etapas: ${a.etapas.map((e) => e.nome).join(" → ")}` : "")
        );
      }
      if (s.sono) partes.push(`  sono: acorda ${s.sono.acorda}, ${s.sono.horas ?? 8}h de sono`);
      if (s.grafico) partes.push(`  gráfico: modelo ${s.grafico.qual}`);
      if (s.mapa) partes.push(`  mapa: ${s.mapa.nos.map((n) => `${n.tipo ?? "nota"}:"${n.txt}"`).join(" / ")}`);
      if (s.fala) partes.push(`  fala: "${s.fala}"`);
      if (s.instrucao) partes.push(`  instrução: ${s.instrucao}`);
      if (s.nota) partes.push(`  fora do estúdio: ${s.nota}`);
      return partes.join("\n");
    })
    .join("\n\n");
}

function resumoCats(blocos: SceneAgendaBlock[]) {
  const contagem = new Map<string, number>();
  for (const b of blocos) contagem.set(b.cat, (contagem.get(b.cat) ?? 0) + 1);
  return Array.from(contagem.entries())
    .map(([cat, n]) => `${n}× ${AGENDA_CATS[cat as AgendaCat] ?? cat}`)
    .join(", ");
}
