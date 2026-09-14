/**
 * O PINTOR: desenha um quadro do vídeo no canvas.
 *
 * É a única peça que sabe como o vídeo fica: o mesmo desenho serve para a
 * prévia na tela e para a exportação, então o que você vê é o que sai. Para
 * mudar o visual do vídeo (posição da legenda, moldura, animação de cena),
 * mexa aqui.
 *
 * O quadro é 1080x1920 (reel). No modo "metadinha" a metade de cima é o vídeo
 * do Augusto e a de baixo é a tela do Estúdio Reels — a mesma proporção
 * 1080x960 do palco do estúdio, por isso a cena é desenhada com as mesmas
 * coordenadas que o estúdio usa.
 */
import { toStudioScene, type StudioScene } from "@/lib/studio/scenes";
import { quebrarTexto } from "@/lib/video/captions";
import type { VideoProject } from "@/lib/video/types";

const FONTE = '"Lato", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
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

export interface Retangulo {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface QuadroInput {
  projeto: VideoProject;
  /** segundo do vídeo original */
  tempoFonte: number;
  /** elemento de vídeo já posicionado no tempo certo (pode faltar) */
  video?: HTMLVideoElement | null;
}

/** Desenha o quadro inteiro. */
export function pintarQuadro(ctx: CanvasRenderingContext2D, input: QuadroInput) {
  const { projeto, tempoFonte, video } = input;
  const L = projeto.largura;
  const A = projeto.altura;

  ctx.save();
  ctx.fillStyle = projeto.layout.fundo || "#2E2E2E";
  ctx.fillRect(0, 0, L, A);

  const modo = projeto.layout.modo;
  const divisao = Math.min(0.9, Math.max(0.1, projeto.layout.divisao || 0.5));
  const areaVideo: Retangulo =
    modo === "metadinha" ? { x: 0, y: 0, w: L, h: A * divisao } : { x: 0, y: 0, w: L, h: A };
  const areaCena: Retangulo =
    modo === "metadinha"
      ? { x: 0, y: A * divisao, w: L, h: A * (1 - divisao) }
      : modo === "tela"
      ? { x: 0, y: 0, w: L, h: A }
      : { x: 0, y: A * 0.58, w: L, h: A * 0.42 };

  if (modo !== "tela" && video && video.readyState >= 2) {
    desenharCobrindo(ctx, video, areaVideo);
  }

  const cena = cenaEm(projeto, tempoFonte);
  if (cena) {
    if (modo === "cheio") {
      ctx.save();
      ctx.globalAlpha = 0.92;
      arredondado(ctx, areaCena.x + 24, areaCena.y, areaCena.w - 48, areaCena.h - 24, 28);
      ctx.fillStyle = projeto.layout.fundo || "#2E2E2E";
      ctx.fill();
      ctx.clip();
      pintarCena(ctx, cena, { x: areaCena.x + 24, y: areaCena.y, w: areaCena.w - 48, h: areaCena.h - 24 });
      ctx.restore();
    } else {
      pintarCena(ctx, cena, areaCena);
    }
  }

  pintarLegenda(ctx, projeto, tempoFonte);
  ctx.restore();
}

/** A tela do estúdio que está no ar neste segundo. */
export function cenaEm(projeto: VideoProject, tempoFonte: number): StudioScene | null {
  const clip = projeto.telas.find((t) => tempoFonte >= t.inicio && tempoFonte < t.fim);
  return clip?.cena ?? null;
}

/** Vídeo preenchendo o retângulo, cortando o excesso (como object-fit: cover). */
function desenharCobrindo(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, r: Retangulo) {
  const vw = video.videoWidth || 1080;
  const vh = video.videoHeight || 1920;
  const escala = Math.max(r.w / vw, r.h / vh);
  const w = vw * escala;
  const h = vh * escala;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  try {
    ctx.drawImage(video, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h);
  } catch {
    // quadro ainda não disponível: deixa o fundo
  }
  ctx.restore();
}

// ------------------------------------------------------- telas do estúdio

/** Desenha uma cena do Estúdio Reels dentro do retângulo (proporção 1080x960). */
export function pintarCena(ctx: CanvasRenderingContext2D, cena: StudioScene, r: Retangulo) {
  const c = toStudioScene(cena) as any;
  const u = r.w / 1080;

  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();

  if (c.tipo === "agenda") pintarAgenda(ctx, c, r, u);
  else if (c.tipo === "sono") pintarSono(ctx, c, r, u);
  else if (c.tipo === "pentagono") pintarPentagono(ctx, r, u);
  else if (c.tipo === "grafico") pintarGrafico(ctx, c.graf?.qual ?? 2, r, u);
  else if (c.tipo === "metas") pintarMetas(ctx, r, u);
  else if (c.tipo === "mapa") pintarMapa(ctx, c, r, u);
  else pintarTextos(ctx, c.blocos ?? [], r, u);

  ctx.restore();
}

function fonte(tam: number, u: number, negrito?: boolean, italico?: boolean) {
  return `${italico ? "italic " : ""}${negrito ? 700 : 300} ${Math.max(8, tam * u)}px ${FONTE}`;
}

function pintarTextos(ctx: CanvasRenderingContext2D, blocos: any[], r: Retangulo, u: number) {
  for (const b of blocos) {
    const tam = (b.tam || 30) * u;
    const linhas = String(b.txt ?? "").split("\n");
    const alturaLinha = tam * 1.18;
    ctx.font = fonte(b.tam || 30, u, b.neg, b.ita);
    ctx.textBaseline = "top";
    const x = r.x + b.x * r.w;
    let y = r.y + b.y * r.h;

    if (b.fundo) {
      const larg = Math.max(...linhas.map((l) => ctx.measureText(l).width));
      arredondado(ctx, x - tam * 0.3, y - tam * 0.22, larg + tam * 0.6, alturaLinha * linhas.length + tam * 0.44, tam * 0.22);
      ctx.fillStyle = b.fundo;
      ctx.fill();
    }

    ctx.fillStyle = b.cor || (b.fundo ? "#191919" : INK);
    for (const linha of linhas) {
      if (b.al === "center") {
        ctx.textAlign = "center";
        ctx.fillText(linha, r.x + r.w / 2, y);
      } else {
        ctx.textAlign = "left";
        ctx.fillText(linha, x, y);
      }
      y += alturaLinha;
    }
    ctx.textAlign = "left";
  }
}

function pintarAgenda(ctx: CanvasRenderingContext2D, c: any, r: Retangulo, u: number) {
  const aj = c.aj ?? {};
  const h0 = aj.h0 ?? 5;
  const h1 = aj.h1 ?? 24;
  const total = Math.max(1, (h1 - h0) * 60);
  const umDia = aj.dia != null;
  const dias = umDia ? [aj.dia] : [0, 1, 2, 3, 4, 5, 6];
  const blocos = (c.agb ?? []).filter((b: any) => !umDia || b.dia === aj.dia);

  const pad = r.w * 0.03;
  const titulo = c.agTit || "Agenda da semana";
  ctx.font = fonte(30, u, true);
  ctx.fillStyle = INK;
  ctx.textBaseline = "top";
  ctx.fillText(titulo, r.x + pad, r.y + pad * 0.6);

  const topo = r.y + pad * 0.6 + 34 * u + pad * 0.5;
  const alturaGrade = r.y + r.h - pad - topo;
  const larguraCol = (r.w - pad * 2) / dias.length;
  const cabecalho = 22 * u;

  dias.forEach((d, i) => {
    const x = r.x + pad + i * larguraCol;
    ctx.fillStyle = "rgba(255,255,255,.04)";
    ctx.fillRect(x + 2, topo, larguraCol - 4, alturaGrade);
    ctx.font = fonte(18, u);
    ctx.fillStyle = DIM;
    ctx.textAlign = "center";
    ctx.fillText(DIAS[d] ?? "", x + larguraCol / 2, topo + 2);
    ctx.textAlign = "left";

    for (const b of blocos.filter((b: any) => b.dia === d)) {
      const y = topo + cabecalho + ((b.ini - h0 * 60) / total) * (alturaGrade - cabecalho);
      const alt = (b.dur / total) * (alturaGrade - cabecalho);
      if (y + alt < topo || y > topo + alturaGrade) continue;
      arredondado(ctx, x + 5, y, larguraCol - 10, Math.max(3, alt - 2), 4 * u);
      ctx.fillStyle = CAT_COR[b.cat] ?? CAT_COR.vaz;
      ctx.fill();
      if (alt > 16 * u && b.rot) {
        ctx.font = fonte(13, u);
        ctx.fillStyle = b.cat === "sono" ? "#FFFFFF" : "#191919";
        const texto = cortarPara(ctx, String(b.rot), larguraCol - 16);
        ctx.fillText(texto, x + 10, y + 3);
      }
    }
  });
}

function pintarSono(ctx: CanvasRenderingContext2D, c: any, r: Retangulo, u: number) {
  const acorda = c.sono?.acorda ?? 420;
  const dur = c.sono?.dur ?? 480;
  const hh = (m: number) => {
    const v = ((m % 1440) + 1440) % 1440;
    return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
  };
  const marcas = [
    { rot: "alarme", min: acorda - dur - 75, cor: "#FADD69" },
    { rot: "deitar", min: acorda - dur - 15, cor: INK },
    { rot: "pega no sono", min: acorda - dur, cor: "#73E294" },
    { rot: "acordar", min: acorda, cor: INK },
  ];

  ctx.font = fonte(30, u);
  ctx.fillStyle = DIM;
  ctx.textBaseline = "top";
  ctx.fillText("Que horas ir pra cama?", r.x + r.w * 0.08, r.y + r.h * 0.18);

  const trilhoY = r.y + r.h * 0.42;
  const trilhoH = r.h * 0.06;
  arredondado(ctx, r.x + r.w * 0.06, trilhoY, r.w * 0.88, trilhoH, trilhoH / 2);
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fill();

  marcas.forEach((m, k) => {
    const x = r.x + r.w * (0.08 + (k / (marcas.length - 1)) * 0.84);
    ctx.fillStyle = m.cor;
    ctx.fillRect(x - 2 * u, trilhoY, 4 * u, trilhoH);
    ctx.textAlign = "center";
    ctx.font = fonte(26, u, true);
    ctx.fillStyle = INK;
    ctx.fillText(hh(m.min), x, trilhoY + trilhoH + 10 * u);
    ctx.font = fonte(16, u);
    ctx.fillStyle = DIM;
    ctx.fillText(m.rot, x, trilhoY + trilhoH + 40 * u);
    ctx.textAlign = "left";
  });
}

const PENT = [
  { nome: "Trabalho", cor: "#E0A458", valor: "60h" },
  { nome: "Lazer", cor: "#7FB685", valor: "6h" },
  { nome: "Aleatórias", cor: "#9B8AC4", valor: "10h" },
  { nome: "Família", cor: "#C9748A", valor: "14h" },
  { nome: "Saúde", cor: "#73E294", valor: "78h" },
];

function pintarPentagono(ctx: CanvasRenderingContext2D, r: Retangulo, u: number) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const raio = Math.min(r.w, r.h) * 0.36;
  ctx.beginPath();
  PENT.forEach((_, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const x = cx + Math.cos(ang) * raio;
    const y = cy + Math.sin(ang) * raio;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(224,164,88,.18)";
  ctx.fill();
  ctx.strokeStyle = DIM;
  ctx.lineWidth = 2 * u;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  PENT.forEach((a, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const x = cx + Math.cos(ang) * (raio * 1.28);
    const y = cy + Math.sin(ang) * (raio * 1.28);
    ctx.font = fonte(26, u, true);
    ctx.fillStyle = a.cor;
    ctx.fillText(a.valor, x, y - 14 * u);
    ctx.font = fonte(16, u);
    ctx.fillStyle = DIM;
    ctx.fillText(a.nome, x, y + 12 * u);
  });
  ctx.font = fonte(34, u, true);
  ctx.fillStyle = INK;
  ctx.fillText("168h", cx, cy - 8 * u);
  ctx.font = fonte(16, u);
  ctx.fillStyle = DIM;
  ctx.fillText("na semana", cx, cy + 18 * u);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
}

function pintarGrafico(ctx: CanvasRenderingContext2D, qual: number, r: Retangulo, u: number) {
  const px = (fx: number, fy: number) => ({ x: r.x + r.w * fx, y: r.y + r.h * fy });
  const eixo0 = px(0.1, 0.86);
  const eixoX = px(0.94, 0.86);
  const eixoY = px(0.1, 0.14);
  ctx.strokeStyle = DIM;
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.moveTo(eixoY.x, eixoY.y);
  ctx.lineTo(eixo0.x, eixo0.y);
  ctx.lineTo(eixoX.x, eixoX.y);
  ctx.stroke();

  const curvas =
    qual === 1
      ? [
          { pts: [0, 100, 100, 100, 100], cor: "#A9C4F5", rot: "musculação 100%" },
          { pts: [0, 60, 60, 60, 60], cor: "#73E294", rot: "jiu-jitsu 60%" },
        ]
      : qual === 3
      ? [
          { pts: [0, 22, 42, 60, 76, 90, 100], cor: "#F06060", rot: "rotina que não gosta" },
          { pts: [0, 10, 20, 30, 39, 48, 57, 65, 73, 80, 87, 94, 100], cor: "#73E294", rot: "rotina que gosta" },
        ]
      : [
          { pts: [0, 14, 27, 39, 50, 60, 69, 77, 84, 89, 93, 96, 98], cor: DIM, rot: "ideal (robô)", tracejado: true },
          { pts: [0, 12, 20, 14, 8, 6, 5, 15, 22, 17, 12, 10, 9], cor: "#F06060", rot: "arranca e desiste" },
          { pts: [0, 7, 14, 20, 26, 32, 38, 43, 49, 54, 59, 63, 67], cor: "#73E294", rot: "constante" },
        ];

  for (const c of curvas) {
    ctx.beginPath();
    ctx.strokeStyle = c.cor;
    ctx.lineWidth = 4 * u;
    ctx.setLineDash((c as any).tracejado ? [10 * u, 8 * u] : []);
    c.pts.forEach((v, i) => {
      const p = px(0.1 + (i / (c.pts.length - 1)) * 0.84, 0.86 - (v / 100) * 0.66);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.font = fonte(18, u);
  ctx.textBaseline = "top";
  let lx = r.x + r.w * 0.1;
  for (const c of curvas) {
    ctx.fillStyle = c.cor;
    const t = `● ${c.rot}`;
    ctx.fillText(t, lx, r.y + r.h * 0.9);
    lx += ctx.measureText(t).width + 18 * u;
  }
}

function pintarMetas(ctx: CanvasRenderingContext2D, r: Retangulo, u: number) {
  const cards = [
    { rot: "Financeiro", meta: "R$ 50 mil/mês", data: "até dez/2026" },
    { rot: "Saúde", meta: "82 kg, 15%", data: "até jun/2026" },
    { rot: "Relacionamentos", meta: "10 eventos", data: "até dez/2026" },
  ];
  const pad = r.w * 0.05;
  const larg = (r.w - pad * 4) / 3;
  cards.forEach((c, i) => {
    const x = r.x + pad + i * (larg + pad);
    const y = r.y + r.h * 0.3;
    const alt = r.h * 0.4;
    arredondado(ctx, x, y, larg, alt, 16 * u);
    ctx.fillStyle = "rgba(255,255,255,.06)";
    ctx.fill();
    ctx.textBaseline = "top";
    ctx.font = fonte(20, u);
    ctx.fillStyle = DIM;
    ctx.fillText(c.rot, x + 14 * u, y + 16 * u);
    ctx.font = fonte(24, u, true);
    ctx.fillStyle = INK;
    ctx.fillText(cortarPara(ctx, c.meta, larg - 28 * u), x + 14 * u, y + 46 * u);
    ctx.font = fonte(17, u);
    ctx.fillStyle = "#73E294";
    ctx.fillText(c.data, x + 14 * u, y + 84 * u);
  });
}

function pintarMapa(ctx: CanvasRenderingContext2D, c: any, r: Retangulo, u: number) {
  const nos = (c.mapa?.nos ?? []).slice(0, 7);
  ctx.textBaseline = "top";
  nos.forEach((n: any, k: number) => {
    const x = r.x + (n.x ?? 10 + (k % 3) * 30) * 0.01 * r.w;
    const y = r.y + (n.y ?? 14 + Math.floor(k / 3) * 26) * 0.01 * r.h;
    const central = n.tipo === "central";
    ctx.font = fonte(central ? 26 : 19, u, central);
    const texto = cortarPara(ctx, String(n.txt ?? ""), r.w * 0.34);
    const larg = ctx.measureText(texto).width + 20 * u;
    arredondado(ctx, x, y, larg, (central ? 38 : 30) * u, 8 * u);
    ctx.fillStyle = central ? "rgba(224,140,58,.28)" : "rgba(255,255,255,.08)";
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillText(texto, x + 10 * u, y + 6 * u);
  });
}

// ------------------------------------------------------------- legendas

export function pintarLegenda(ctx: CanvasRenderingContext2D, projeto: VideoProject, tempoFonte: number) {
  const clip = projeto.legendas.find((l) => tempoFonte >= l.inicio && tempoFonte < l.fim);
  if (!clip?.texto) return;
  const e = projeto.legendaEstilo;
  const texto = e.maiusculas ? clip.texto.toUpperCase() : clip.texto;
  const linhas = quebrarTexto(texto, e.largura || 32);
  const tam = e.tamanho;
  const alturaLinha = tam * 1.25;
  const alturaTotal = alturaLinha * linhas.length;

  const y =
    e.posicao === "topo"
      ? projeto.altura * e.margem
      : e.posicao === "centro"
      ? (projeto.altura - alturaTotal) / 2
      : projeto.altura * (1 - e.margem) - alturaTotal;

  ctx.save();
  ctx.font = `700 ${tam}px ${FONTE}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  linhas.forEach((linha, i) => {
    const larg = ctx.measureText(linha).width;
    const cx = projeto.largura / 2;
    const ly = y + i * alturaLinha;
    if (e.fundo && e.fundo !== "transparent") {
      arredondado(ctx, cx - larg / 2 - tam * 0.35, ly - tam * 0.16, larg + tam * 0.7, alturaLinha, tam * 0.22);
      ctx.fillStyle = e.fundo;
      ctx.fill();
    }
    if (e.contorno) {
      ctx.lineWidth = Math.max(3, tam * 0.12);
      ctx.strokeStyle = "rgba(0,0,0,.85)";
      ctx.lineJoin = "round";
      ctx.strokeText(linha, cx, ly);
    }
    ctx.fillStyle = e.cor;
    ctx.fillText(linha, cx, ly);
  });
  ctx.restore();
}

// ------------------------------------------------------------- utilidades

function arredondado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, raio: number) {
  const r = Math.min(raio, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function cortarPara(ctx: CanvasRenderingContext2D, texto: string, largura: number) {
  if (ctx.measureText(texto).width <= largura) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > largura) t = t.slice(0, -1);
  return `${t}…`;
}
