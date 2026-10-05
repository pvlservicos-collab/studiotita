/**
 * Projetos da aba Vídeo: o que a linha do tempo edita e o que o motor toca.
 */
import { query, queryOne } from "@/lib/db";
import { getStudioFlow } from "@/lib/services/studioFlows";
import { legendasDaTranscricao } from "@/lib/video/captions";
import { projetoVazio, type VideoProject } from "@/lib/video/types";
import { telasDoFluxo } from "@/lib/video/telas";
import type { StudioScene } from "@/lib/studio/scenes";

export class VideoProjectInputError extends Error {}

export interface VideoProjectRow {
  id: string;
  title: string;
  flow_id: string | null;
  script_id: string | null;
  video_id: string | null;
  source_url: string | null;
  source_name: string | null;
  duration: number | null;
  project: VideoProject;
  export_url: string | null;
  render_status?: "parado" | "na_fila" | "renderizando" | "pronto" | "erro";
  render_progress?: number | string;
  render_etapa?: string | null;
  render_error?: string | null;
  render_ms?: number | null;
  status: "rascunho" | "pronto" | "exportado";
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // do join
  flow_title?: string | null;
}

export async function listVideoProjects(limit = 50) {
  return query<VideoProjectRow>(
    `select p.id, p.title, p.flow_id, p.script_id, p.video_id, p.source_url, p.source_name, p.duration,
            p.export_url, p.status, p.render_status, p.render_progress, p.render_etapa, p.render_error, p.render_ms,
            p.created_by, p.created_at, p.updated_at,
            f.title as flow_title
     from video_projects p
     left join studio_flows f on f.id = p.flow_id
     order by p.updated_at desc limit $1`,
    [Math.min(limit, 200)]
  );
}

export async function getVideoProject(id: string) {
  return queryOne<VideoProjectRow>(
    `select p.*, f.title as flow_title from video_projects p
     left join studio_flows f on f.id = p.flow_id where p.id = $1`,
    [id]
  );
}

export async function updateVideoProject(
  id: string,
  input: {
    title?: string;
    project?: VideoProject;
    status?: string;
    export_url?: string | null;
    source_url?: string | null;
    source_name?: string | null;
    duration?: number | null;
    flow_id?: string | null;
  }
) {
  const campos: [string, unknown][] = [
    ["title", input.title],
    ["project", input.project ? JSON.stringify(input.project) : undefined],
    ["status", input.status],
    ["export_url", input.export_url],
    ["source_url", input.source_url],
    ["source_name", input.source_name],
    ["duration", input.duration],
    ["flow_id", input.flow_id],
  ];
  const sets: string[] = [];
  const params: unknown[] = [id];
  for (const [coluna, valor] of campos) {
    if (valor === undefined) continue;
    params.push(valor);
    sets.push(`${coluna} = $${params.length}`);
  }
  if (!sets.length) return getVideoProject(id);
  return queryOne<VideoProjectRow>(`update video_projects set ${sets.join(", ")} where id = $1 returning *`, params);
}

export async function deleteVideoProject(id: string) {
  const row = await queryOne<{ id: string }>(`delete from video_projects where id = $1 returning id`, [id]);
  return Boolean(row);
}

/**
 * Cria o projeto já montado: as telas da metadinha viram clipes na linha do
 * tempo (no tempo que o fluxo indicou) e, se o vídeo de origem tiver
 * transcrição, as legendas já entram prontas.
 */
export async function createVideoProject(input: {
  title?: string;
  flow_id?: string | null;
  video_id?: string | null;
  script_id?: string | null;
  source_url?: string | null;
  source_name?: string | null;
  duration?: number | null;
  created_by?: string | null;
  /** só gera legendas da transcrição quando pedido */
  com_legendas?: boolean;
}): Promise<VideoProjectRow> {
  const flow = input.flow_id ? await getStudioFlow(input.flow_id) : null;
  const titulo = input.title?.trim() || flow?.title || "Vídeo novo";

  const projeto = projetoVazio(titulo);
  if (input.source_url) {
    projeto.fonte = {
      url: input.source_url,
      nome: input.source_name ?? null,
      duracao: Number(input.duration ?? 0),
      largura: null,
      altura: null,
    };
  }

  if (flow) {
    projeto.telas = telasDoFluxo((flow.scenes as StudioScene[]) ?? [], Number(input.duration ?? 0));
  }

  // As legendas NÃO vêm por padrão: só entram quando o usuário mandar gerar
  // (no editor, botão "Gerar legendas"), para não encher a linha do tempo de
  // um texto que talvez nem sirva para este vídeo.
  const videoId = input.video_id ?? flow?.video_id ?? null;
  if (input.com_legendas && videoId) {
    const a = await queryOne<{ transcript: string | null }>(
      `select transcript from analyses where video_id = $1 and status = 'done' order by requested_at desc limit 1`,
      [videoId]
    );
    if (a?.transcript) {
      projeto.legendas = legendasDaTranscricao(a.transcript, { duracao: Number(input.duration ?? 0) || undefined });
    }
  }

  const row = await queryOne<VideoProjectRow>(
    `insert into video_projects (title, flow_id, script_id, video_id, source_url, source_name, duration, project, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
    [
      titulo,
      input.flow_id ?? null,
      input.script_id ?? null,
      videoId,
      input.source_url ?? null,
      input.source_name ?? null,
      input.duration ?? null,
      JSON.stringify(projeto),
      input.created_by ?? "pedro",
    ]
  );
  if (!row) throw new Error("Falha ao criar o projeto de vídeo.");
  return row;
}

/**
 * Traz um vídeo de fora (link que o Augusto mandou) para o projeto: copia o
 * arquivo para o nosso Blob, mede a duração e grava no projeto.
 * É por aqui que o Claude dele manda o vídeo sem passar pelo site.
 */
export async function anexarVideoPorUrl(id: string, url: string, nome?: string | null) {
  const { put } = await import("@vercel/blob");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const { duracaoDoArquivo } = await import("@/lib/video/render/probe");

  const linha = await getVideoProject(id);
  if (!linha) throw new VideoProjectInputError(`Projeto ${id} não encontrado.`);

  const res = await fetch(url);
  if (!res.ok) throw new VideoProjectInputError(`Não consegui baixar o vídeo em ${url} (status ${res.status}).`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const arquivo = nome?.trim() || url.split("/").pop()?.split("?")[0] || "video.mp4";

  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "videoteca-in-"));
  const temporario = path.join(pasta, arquivo);
  await fs.writeFile(temporario, bytes);
  const duracao = await duracaoDoArquivo(temporario);
  await fs.rm(pasta, { recursive: true, force: true }).catch(() => undefined);

  const blob = await put(`videos-brutos/${id}-${arquivo}`, bytes, {
    access: "public",
    addRandomSuffix: true,
    contentType: res.headers.get("content-type") || "video/mp4",
  });

  const projeto: VideoProject = {
    ...linha.project,
    fonte: { url: blob.url, nome: arquivo, duracao, largura: null, altura: null },
  };
  // as telas vão até onde o vídeo vai
  if (!projeto.telas?.length && linha.flow_id) {
    const flow = await getStudioFlow(linha.flow_id);
    if (flow) projeto.telas = telasDoFluxo((flow.scenes as StudioScene[]) ?? [], duracao);
  }

  return updateVideoProject(id, { project: projeto, source_url: blob.url, source_name: arquivo, duration: duracao });
}
