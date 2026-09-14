/**
 * Fluxos do Estúdio Reels ("metadinhas").
 *
 * - Fluxos de REFERÊNCIA: os que o Augusto montou de verdade, ligados ao
 *   vídeo em que foram usados (vêm do projeto salvo no estúdio e da leitura
 *   frame a frame). São eles + o arquivo de padrões que ensinam o sistema.
 * - Fluxos GERADOS: quando uma análise fica pronta com o toggle "Gerar
 *   metadinha" ligado, o sistema lê o resumo, a estrutura e o frame a frame e
 *   monta o esquema de telas que combina com aquele vídeo — já no formato de
 *   projeto do estúdio, pronto para abrir.
 */
import { query, queryOne } from "@/lib/db";
import { generateJsonWithGemini } from "@/lib/gemini";
import { ESTUDIO_REELS_FILE, ESTUDIO_REELS_GUIDE } from "@/lib/estudioReels";
import { ESTUDIO_PADROES, ESTUDIO_PADROES_FILE } from "@/lib/studio/patterns";
import {
  AGENDA_CATS,
  AGENDA_CAT_IDS,
  LINE_ROLES,
  SCENE_TYPES,
  flowToText,
  toStudioProject,
  type AgendaCat,
  type LineRole,
  type SceneType,
  type StudioFlowContent,
  type StudioScene,
} from "@/lib/studio/scenes";
import { ETAPAS_PADRAO, SEMANA_PADRAO } from "@/lib/studio/semanaPadrao";
import { MODELOS_RESUMO, acharModelo } from "@/lib/studio/modelos";
import type { AnalysisRow, StudioFlowRow, VideoRow } from "@/lib/types";

export class StudioFlowInputError extends Error {}

/** Depois deste tempo em "processing" o fluxo travou (a função morreu antes de terminar). */
export const FLOW_STALE_MS = 10 * 60 * 1000;

// ------------------------------------------------------------------ leitura

export async function listStudioFlows(opts: { kind?: "referencia" | "gerado"; videoId?: string; limit?: number } = {}) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.kind) {
    params.push(opts.kind);
    where.push(`f.kind = $${params.length}`);
  }
  if (opts.videoId) {
    params.push(opts.videoId);
    where.push(`f.video_id = $${params.length}`);
  }
  params.push(Math.min(opts.limit ?? 100, 300));
  // o projeto (o JSON que abre no estúdio) fica de fora da lista: é grande e
  // a lista só precisa das cenas para mostrar o resumo
  return query<StudioFlowRow>(
    `select f.id, f.video_id, f.analysis_id, f.kind, f.title, f.summary, f.scenes, f.link_source, f.link_confidence,
            f.link_reason, f.status, f.error_message, f.model, f.created_by, f.created_at, f.updated_at,
            v.caption as video_caption, v.thumbnail_url as video_thumbnail_url, v.permalink as video_permalink,
            v.views as video_views, v.saves as video_saves, v.posted_at as video_posted_at
     from studio_flows f
     left join videos v on v.id = f.video_id
     ${where.length ? `where ${where.join(" and ")}` : ""}
     order by f.kind, coalesce(v.views, 0) desc, f.created_at desc
     limit $${params.length}`,
    params
  );
}

export async function getStudioFlow(id: string) {
  return queryOne<StudioFlowRow>(
    `select f.*, v.caption as video_caption, v.thumbnail_url as video_thumbnail_url, v.permalink as video_permalink,
            v.views as video_views, v.saves as video_saves, v.posted_at as video_posted_at
     from studio_flows f left join videos v on v.id = f.video_id where f.id = $1`,
    [id]
  );
}

export async function getFlowForAnalysis(analysisId: string) {
  return queryOne<StudioFlowRow>(
    `select * from studio_flows where analysis_id = $1 order by created_at desc limit 1`,
    [analysisId]
  );
}

export async function deleteStudioFlow(id: string) {
  const row = await queryOne<{ id: string }>(`delete from studio_flows where id = $1 returning id`, [id]);
  return Boolean(row);
}

/** Texto dos padrões: o arquivo da Biblioteca manda; sem ele, vale o embutido. */
export async function padroesText() {
  const row = await queryOne<{ text_content: string | null }>(
    `select text_content from files where name = $1 order by created_at desc limit 1`,
    [ESTUDIO_PADROES_FILE]
  );
  const texto = row?.text_content?.trim();
  return { text: texto || ESTUDIO_PADROES, source: texto ? "biblioteca" : "padrao" };
}

async function guiaText() {
  const row = await queryOne<{ text_content: string | null }>(
    `select text_content from files where name = $1 order by created_at desc limit 1`,
    [ESTUDIO_REELS_FILE]
  );
  return row?.text_content?.trim() || ESTUDIO_REELS_GUIDE;
}

// ------------------------------------------------------------------ escrita

export interface SaveFlowInput {
  video_id?: string | null;
  analysis_id?: string | null;
  kind?: "referencia" | "gerado";
  title: string;
  summary?: string | null;
  scenes?: StudioScene[] | null;
  link_source?: string | null;
  link_confidence?: "alta" | "media" | "baixa" | null;
  link_reason?: string | null;
  /** projeto pronto do estúdio; sem ele, é montado a partir das cenas */
  project?: unknown;
  prompt?: string | null;
  model?: string | null;
  created_by?: string | null;
}

export async function saveStudioFlow(input: SaveFlowInput): Promise<StudioFlowRow> {
  const scenes = input.scenes ?? [];
  const project = input.project ?? toStudioProject(scenes);
  const row = await queryOne<StudioFlowRow>(
    `insert into studio_flows (video_id, analysis_id, kind, title, summary, scenes, project,
                               link_source, link_confidence, link_reason, status, prompt, model, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'done', $11, $12, $13)
     returning *`,
    [
      input.video_id ?? null,
      input.analysis_id ?? null,
      input.kind ?? "gerado",
      input.title,
      input.summary ?? null,
      JSON.stringify(scenes),
      JSON.stringify(project),
      input.link_source ?? null,
      input.link_confidence ?? null,
      input.link_reason ?? null,
      input.prompt ?? null,
      input.model ?? null,
      input.created_by ?? "pedro",
    ]
  );
  if (!row) throw new Error("Falha ao salvar o fluxo do Estúdio.");
  return row;
}

/** Liga (ou desliga) um fluxo de referência a um vídeo. */
export async function linkStudioFlow(id: string, videoId: string | null, reason?: string | null) {
  return queryOne<StudioFlowRow>(
    `update studio_flows set video_id = $2, link_reason = coalesce($3, link_reason), link_source = coalesce(link_source, 'ligado a mao')
     where id = $1 returning *`,
    [id, videoId, reason ?? null]
  );
}

// --------------------------------------------------------------- validação

function texto(v: unknown, max = 400) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function numero(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Deixa o que o Gemini devolveu dentro do formato que o estúdio entende. */
export function sanitizeScenes(cenas: unknown): StudioScene[] {
  if (!Array.isArray(cenas)) return [];
  return cenas.slice(0, 40).map((raw) => {
    const c = (raw ?? {}) as Record<string, any>;
    const tipo = (SCENE_TYPES as readonly string[]).includes(c.tipo) ? (c.tipo as SceneType) : "texto";
    const cena: StudioScene = {
      inicio: texto(c.inicio, 8) || undefined,
      fim: texto(c.fim, 8) || undefined,
      tipo,
      titulo: texto(c.titulo, 120) || undefined,
      fala: texto(c.fala, 600) || undefined,
      instrucao: texto(c.instrucao, 600) || undefined,
      nota: texto(c.nota, 400) || undefined,
    };

    if (Array.isArray(c.linhas) && c.linhas.length) {
      cena.linhas = c.linhas
        .slice(0, 8)
        .map((l: any) => ({
          txt: texto(l?.txt, 200),
          papel: (LINE_ROLES as readonly string[]).includes(l?.papel) ? (l.papel as LineRole) : undefined,
          cor: /^#[0-9a-fA-F]{6}$/.test(l?.cor ?? "") ? l.cor : undefined,
        }))
        .filter((l: { txt: string }) => l.txt);
    }

    // Cena de agenda sem blocos abriria uma grade vazia no estúdio. Nesse caso
    // entra o modelo pronto que ele pediu (ou a semana padrão do Augusto).
    if (tipo === "agenda" && !(c.agenda && Array.isArray(c.agenda.blocos) && c.agenda.blocos.length)) {
      const modelo = acharModelo(c.agenda?.modelo);
      cena.agenda = {
        recorte: "semana",
        titulo: texto(c.agenda?.titulo, 120) || "Agenda da semana",
        modelo: modelo?.nome,
        blocos: modelo ? modelo.blocos : SEMANA_PADRAO,
        etapas: ETAPAS_PADRAO.map((e) => ({ nome: e.nome, cats: [...e.cats] as AgendaCat[] })),
      };
      cena.instrucao = [
        cena.instrucao,
        modelo
          ? `Grade base: modelo "${modelo.nome}" do estúdio (${modelo.desc}).`
          : "Grade base: a semana padrão do Augusto — ajuste os rótulos e os horários no estúdio.",
      ]
        .filter(Boolean)
        .join(" ");
    } else if (tipo === "agenda" && c.agenda) {
      const a = c.agenda as Record<string, any>;
      const blocos = Array.isArray(a.blocos) ? a.blocos : [];
      cena.agenda = {
        recorte: a.recorte === "dia" ? "dia" : "semana",
        dia: a.dia != null ? Math.max(0, Math.min(6, Math.round(numero(a.dia, 0)))) : undefined,
        h0: a.h0 != null ? Math.max(0, Math.min(23, Math.round(numero(a.h0, 5)))) : undefined,
        h1: a.h1 != null ? Math.max(1, Math.min(24, Math.round(numero(a.h1, 24)))) : undefined,
        lista: Boolean(a.lista),
        modelo: acharModelo(a.modelo)?.nome,
        titulo: texto(a.titulo, 120) || undefined,
        nivel: a.nivel != null ? Math.round(numero(a.nivel, 0)) : undefined,
        blocos: blocos.slice(0, 120).map((b: any) => ({
          dia: Math.max(0, Math.min(6, Math.round(numero(b?.dia, 0)))),
          inicio: texto(b?.inicio, 6) || "08:00",
          dur: Math.max(15, Math.min(720, Math.round(numero(b?.dur, 60)))),
          cat: (AGENDA_CAT_IDS as readonly string[]).includes(b?.cat) ? (b.cat as AgendaCat) : "vaz",
          rot: texto(b?.rot, 60),
          nv: b?.nv != null ? Math.round(numero(b.nv, 0)) : undefined,
        })),
        etapas: Array.isArray(a.etapas)
          ? a.etapas.slice(0, 8).map((e: any) => ({
              nome: texto(e?.nome, 60),
              cats: Array.isArray(e?.cats)
                ? e.cats.filter((x: unknown) => (AGENDA_CAT_IDS as readonly string[]).includes(String(x))).map(String)
                : undefined,
            }))
          : undefined,
      } as StudioScene["agenda"];
    }

    if (tipo === "sono" && c.sono) {
      cena.sono = { acorda: texto(c.sono.acorda, 6) || "07:00", horas: Math.max(4, Math.min(12, numero(c.sono.horas, 8))) };
    }
    if (tipo === "grafico") {
      const qual = Math.round(numero(c.grafico?.qual, 2));
      cena.grafico = { qual: qual === 1 || qual === 3 ? (qual as 1 | 3) : 2 };
    }
    if (tipo === "mapa" && c.mapa && Array.isArray(c.mapa.nos)) {
      cena.mapa = {
        nos: c.mapa.nos.slice(0, 12).map((n: any) => ({ tipo: texto(n?.tipo, 20) || "nota", txt: texto(n?.txt, 80) })).filter((n: { txt: string }) => n.txt),
      };
    }
    return cena;
  });
}

// ---------------------------------------------------------------- geração

const FLOW_SCHEMA = {
  type: "OBJECT",
  properties: {
    titulo: { type: "STRING" },
    resumo: { type: "STRING" },
    cenas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          inicio: { type: "STRING" },
          fim: { type: "STRING" },
          tipo: { type: "STRING" },
          titulo: { type: "STRING" },
          linhas: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { txt: { type: "STRING" }, papel: { type: "STRING" }, cor: { type: "STRING" } },
              required: ["txt"],
            },
          },
          agenda: {
            type: "OBJECT",
            properties: {
              recorte: { type: "STRING" },
              dia: { type: "NUMBER" },
              h0: { type: "NUMBER" },
              h1: { type: "NUMBER" },
              lista: { type: "BOOLEAN" },
              modelo: { type: "STRING" },
              titulo: { type: "STRING" },
              nivel: { type: "NUMBER" },
              blocos: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    dia: { type: "NUMBER" },
                    inicio: { type: "STRING" },
                    dur: { type: "NUMBER" },
                    cat: { type: "STRING" },
                    rot: { type: "STRING" },
                    nv: { type: "NUMBER" },
                  },
                  required: ["dia", "inicio", "dur", "cat", "rot"],
                },
              },
              etapas: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: { nome: { type: "STRING" }, cats: { type: "ARRAY", items: { type: "STRING" } } },
                  required: ["nome"],
                },
              },
            },
          },
          sono: { type: "OBJECT", properties: { acorda: { type: "STRING" }, horas: { type: "NUMBER" } } },
          grafico: { type: "OBJECT", properties: { qual: { type: "NUMBER" } } },
          mapa: {
            type: "OBJECT",
            properties: {
              nos: {
                type: "ARRAY",
                items: { type: "OBJECT", properties: { tipo: { type: "STRING" }, txt: { type: "STRING" } }, required: ["txt"] },
              },
            },
          },
          fala: { type: "STRING" },
          instrucao: { type: "STRING" },
          nota: { type: "STRING" },
        },
        required: ["inicio", "tipo", "titulo", "fala", "instrucao"],
      },
    },
  },
  required: ["titulo", "resumo", "cenas"],
};

/** Até 3 fluxos de referência (os de melhor desempenho) como exemplo para o Gemini. */
async function exemplosDeReferencia(limite = 3) {
  const rows = await listStudioFlows({ kind: "referencia", limit: 20 });
  const comCenas = rows.filter((r) => Array.isArray(r.scenes) && (r.scenes as StudioScene[]).length);
  return comCenas.slice(0, limite).map((r, i) => {
    const cenas = r.scenes as StudioScene[];
    const numeros = r.video_views != null ? ` · ${r.video_views} views${r.video_saves ? `, ${r.video_saves} salvamentos` : ""}` : "";
    return `### Exemplo ${i + 1}: ${r.title}${numeros}\n${r.summary ? `${r.summary}\n` : ""}${flowToText(cenas)}`;
  });
}

function corta(t: string | null | undefined, max: number) {
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export async function buildFlowPrompt(video: VideoRow | null, analysis: AnalysisRow) {
  const [guia, padroes, exemplos] = await Promise.all([guiaText(), padroesText(), exemplosDeReferencia()]);

  const cats = AGENDA_CAT_IDS.map((c) => `${c} = ${AGENDA_CATS[c]}`).join("; ");

  return [
    `Você monta as telas do ESTÚDIO REELS do Augusto Weber (@augustotita) — as "metadinhas": o vídeo tem o Augusto no terço de cima e a tela do estúdio na metade de baixo.`,
    `Sua tarefa: ler a análise do vídeo abaixo e montar o FLUXO DE CENAS da metade de baixo que combina com esse vídeo, do primeiro ao último segundo, usando SÓ o que o estúdio sabe fazer.`,
    ``,
    `=== O QUE O ESTÚDIO FAZ ===`,
    guia,
    ``,
    `=== PADRÕES DO AUGUSTO (aprendidos dos fluxos e das metadinhas dele) ===`,
    padroes.text,
    exemplos.length ? `\n=== FLUXOS REAIS DELE (siga este nível de detalhe) ===\n${exemplos.join("\n\n")}` : "",
    ``,
    `=== O VÍDEO PARA O QUAL VOCÊ VAI MONTAR AS TELAS ===`,
    video ? `Legenda: ${corta(video.caption, 400)}` : "",
    video?.views ? `Desempenho: ${video.views} views, ${video.likes} curtidas, ${video.comments} comentários, ${video.saves} salvamentos` : "",
    analysis.summary ? `\nRESUMO:\n${analysis.summary}` : "",
    analysis.hook ? `\nGANCHO:\n${analysis.hook}` : "",
    analysis.structure ? `\nESTRUTURA (engenharia reversa):\n${analysis.structure}` : "",
    analysis.transcript ? `\nTRANSCRIÇÃO:\n${corta(analysis.transcript, 7000)}` : "",
    analysis.frames ? `\nFRAME A FRAME (o que aparecia na tela):\n${corta(analysis.frames, 8000)}` : "",
    ``,
    `=== COMO RESPONDER ===`,
    `Devolva "titulo" (curto, o nome do fluxo), "resumo" (2 a 4 linhas: por que este esquema combina com este vídeo e o que ele constrói na tela) e "cenas".`,
    `Cada cena tem:`,
    `- "inicio" e "fim" no formato mm:ss, cobrindo o vídeo inteiro, sem buracos e sem sobreposição;`,
    `- "tipo": um de ${SCENE_TYPES.join(", ")};`,
    `- "titulo": nome curto da cena;`,
    `- "linhas": o texto que aparece na tela, uma entrada por linha, com "papel" (${LINE_ROLES.join(", ")}). Máximo 6 palavras por linha e 4 linhas por tela. Escreva o texto EXATO, não descreva;`,
    `- "agenda": OBRIGATÓRIO quando "tipo" for "agenda". Tem "recorte" ("semana" ou "dia"), "dia" (0=segunda, com recorte "dia"), "h0"/"h1" (faixa de horas mostrada, normalmente 5 e 24), "lista" (mostra a lista de atividades ao lado), "titulo" (o título em cima da agenda), "nivel" (quando for escada de níveis), "blocos" e "etapas" (a ordem da revelação, cada etapa com "nome" e "cats"). Categorias: ${cats}. Exemplo de blocos:`,
    `  "blocos": [{"dia":0,"inicio":"05:00","dur":120,"cat":"sono","rot":"Dormir"},{"dia":0,"inicio":"08:00","dur":60,"cat":"f1","rot":"Prioridades"},{"dia":0,"inicio":"10:00","dur":60,"cat":"f2","rot":"Reunião"},{"dia":0,"inicio":"12:00","dur":60,"cat":"f3","rot":"Almoço"},{"dia":0,"inicio":"17:30","dur":60,"cat":"desvio","rot":"Coringa"},{"dia":0,"inicio":"19:00","dur":60,"cat":"f3","rot":"Treino"}]`,
    `  MODELOS PRONTOS: em vez de inventar a grade, você pode pôr em "agenda.modelo" o nome de um modelo do estúdio e deixar "blocos" vazio — a grade entra pronta, igual à que o Augusto usa. Modelos: ${MODELOS_RESUMO}. Use "Semana caótica", "Semana lotada" ou "Semana mapeada (antes)" como ANTI-exemplo (o erro), e "Semana equilibrada", "Semana flexível" ou "Balizadores" como o certo. Só monte "blocos" à mão quando o vídeo pedir uma grade que nenhum modelo representa.`,
    `  REGRA DA AGENDA: se o vídeo fala de semana, dia, rotina, horário, prioridade, imprevisto, foco ou organização, PELO MENOS UMA cena tem que ser tipo "agenda" com a grade montada — é a tela mais usada pelo Augusto e o que mais segura a retenção. Monte os blocos você mesmo a partir do exemplo que a fala descreve, com rótulos curtos e genéricos ("Trabalho", "Reunião", "Almoço", "Treino", "Prioridades", "Atividade", "Coringa", "Dormir"), de 8 a 40 blocos, repetindo nos dias da semana quando fizer sentido. Nunca descreva a agenda só na instrução: preencha os blocos.`,
    `- "sono" (acorda "07:00", horas 8), "grafico" (qual: 1, 2 ou 3) ou "mapa" (nos com tipo e txt), conforme o tipo;`,
    `- "fala": o trecho da fala do Augusto nesse pedaço (use a transcrição, resumida se for longa);`,
    `- "instrucao": a instrução para ele gravar (ritmo, pausa, onde apontar, o que circular/desenhar com a caneta, o que surge em cada etapa);`,
    `- "nota": só quando a cena depender de algo que o estúdio NÃO faz (print de comentário, foto, meme, gravação de tela do app, ilustração importada). Nesse caso escreva o que precisa ser importado.`,
    `Entre 5 e 10 cenas. No máximo 2 cenas de agenda com a grade montada, cada uma com no máximo 25 blocos (quando a agenda repetir, diga na instrução o que muda em vez de repetir todos os blocos).`,
    `Não invente dados nem números que não estão na análise. Escreva tudo em português do Brasil e seja econômico: instruções de 1 a 2 frases.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Monta a metadinha de uma análise pronta. Cria a linha em 'processing',
 * chama o Gemini e grava o resultado (ou o erro) na mesma linha.
 */
export async function generateStudioFlow(analysisId: string, createdBy = "pedro"): Promise<StudioFlowRow> {
  const analysis = await queryOne<AnalysisRow>(`select * from analyses where id = $1`, [analysisId]);
  if (!analysis) throw new StudioFlowInputError(`Análise ${analysisId} não encontrada.`);
  if (analysis.status !== "done") {
    throw new StudioFlowInputError("A análise ainda não terminou — a metadinha é montada a partir dela.");
  }
  const video = await queryOne<VideoRow>(`select * from videos where id = $1`, [analysis.video_id]);

  // já tem uma montagem em andamento (e não travada): não dispara outra
  const emAndamento = await queryOne<StudioFlowRow>(
    `select * from studio_flows
     where analysis_id = $1 and status in ('pending', 'processing') and created_at > now() - interval '10 minutes'
     order by created_at desc limit 1`,
    [analysisId]
  );
  if (emAndamento) return emAndamento;

  const prompt = await buildFlowPrompt(video, analysis);
  const linha = await queryOne<StudioFlowRow>(
    `insert into studio_flows (video_id, analysis_id, kind, title, status, prompt, model, created_by)
     values ($1, $2, 'gerado', $3, 'processing', $4, $5, $6) returning *`,
    [
      analysis.video_id,
      analysisId,
      `Metadinha · ${(video?.caption ?? "vídeo").split("\n")[0].slice(0, 60)}`,
      prompt,
      process.env.GEMINI_MODEL || "gemini-2.5-pro",
      createdBy,
    ]
  );
  if (!linha) throw new Error("Falha ao criar o fluxo do Estúdio.");

  try {
    const { result, model } = await generateJsonWithGemini<StudioFlowContent>(prompt, FLOW_SCHEMA, {
      maxOutputTokens: 60000,
      temperature: 0.7,
    });
    const cenas = sanitizeScenes(result?.cenas);
    if (!cenas.length) throw new StudioFlowInputError("O Gemini não devolveu nenhuma cena.");
    const atualizada = await queryOne<StudioFlowRow>(
      `update studio_flows set status = 'done', title = $2, summary = $3, scenes = $4, project = $5, model = $6
       where id = $1 returning *`,
      [
        linha.id,
        texto(result?.titulo, 120) || linha.title,
        texto(result?.resumo, 2000) || null,
        JSON.stringify(cenas),
        JSON.stringify(toStudioProject(cenas)),
        model,
      ]
    );
    return atualizada ?? linha;
  } catch (err) {
    const mensagem = (err as Error)?.message ?? "Erro inesperado ao montar a metadinha.";
    await query(`update studio_flows set status = 'error', error_message = $2 where id = $1`, [linha.id, mensagem]);
    throw err;
  }
}

/** Metadinha da análise mais recente de um vídeo (gera se ainda não existir). */
export async function generateFlowForVideo(videoId: string, createdBy = "pedro") {
  const analysis = await queryOne<AnalysisRow>(
    `select * from analyses where video_id = $1 and status = 'done' order by requested_at desc limit 1`,
    [videoId]
  );
  if (!analysis) {
    throw new StudioFlowInputError("Este vídeo ainda não tem análise pronta do Gemini. Analise o vídeo primeiro.");
  }
  return generateStudioFlow(analysis.id, createdBy);
}
