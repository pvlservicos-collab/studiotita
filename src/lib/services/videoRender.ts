/**
 * Render no servidor: pega o projeto, chama o renderizador (ffmpeg + o pintor
 * em Node) e guarda o mp4 no Vercel Blob.
 *
 * O progresso é gravado no próprio projeto, então tanto o editor quanto o
 * Claude do Augusto (pelo MCP) acompanham pelo mesmo lugar.
 */
import { put } from "@vercel/blob";
import { query, queryOne } from "@/lib/db";
import { getVideoProject, type VideoProjectRow } from "@/lib/services/videoProjects";
import { renderizarProjeto } from "@/lib/video/render/render";
import fs from "node:fs/promises";
import path from "node:path";

async function marcar(id: string, campos: Record<string, unknown>) {
  const chaves = Object.keys(campos);
  if (!chaves.length) return;
  const sets = chaves.map((c, i) => `${c} = $${i + 2}`);
  await query(`update video_projects set ${sets.join(", ")} where id = $1`, [id, ...chaves.map((c) => campos[c])]);
}

export const renderizarNoServidor = {
  /** Marca o projeto como "na fila" e devolve a linha atualizada. */
  async iniciar(id: string) {
    await marcar(id, {
      render_status: "na_fila",
      render_progress: 0,
      render_etapa: "na fila",
      render_error: null,
      render_started_at: new Date().toISOString(),
      render_ms: null,
    });
    return (await getVideoProject(id)) as VideoProjectRow;
  },

  /** Faz o render de verdade (roda em background na mesma invocação). */
  async processar(id: string) {
    const linha = await getVideoProject(id);
    if (!linha) return;

    let ultimoAviso = 0;
    try {
      await marcar(id, { render_status: "renderizando", render_etapa: "preparando" });

      const resultado = await renderizarProjeto(linha.project, {
        onProgresso: (fracao, etapa) => {
          const agora = Date.now();
          if (agora - ultimoAviso < 2000 && fracao < 1) return;
          ultimoAviso = agora;
          void marcar(id, { render_progress: Number(fracao.toFixed(3)), render_etapa: etapa });
        },
      });

      const bytes = await fs.readFile(resultado.arquivo);
      const nome = `${(linha.title || "video").replace(/[^\w\d\- ]+/g, "").slice(0, 50) || "video"}.mp4`;
      const blob = await put(`videos-prontos/${id}-${nome}`, bytes, {
        access: "public",
        contentType: "video/mp4",
        addRandomSuffix: true,
      });

      await marcar(id, {
        render_status: "pronto",
        render_progress: 1,
        render_etapa: "pronto",
        render_ms: Math.round(resultado.segundos * 1000),
        export_url: blob.url,
        status: "exportado",
      });

      await fs.rm(path.dirname(resultado.arquivo), { recursive: true, force: true }).catch(() => undefined);
    } catch (err) {
      console.error(`Erro ao renderizar o projeto ${id}:`, err);
      await marcar(id, {
        render_status: "erro",
        render_etapa: null,
        render_error: (err as Error).message?.slice(0, 2000) ?? "erro desconhecido",
      });
    }
  },

  /** Status curto, para o MCP e para o editor. */
  async status(id: string) {
    return queryOne<{
      id: string;
      title: string;
      render_status: string;
      render_progress: string;
      render_etapa: string | null;
      render_error: string | null;
      render_ms: number | null;
      export_url: string | null;
    }>(
      `select id, title, render_status, render_progress, render_etapa, render_error, render_ms, export_url
       from video_projects where id = $1`,
      [id]
    );
  },
};
