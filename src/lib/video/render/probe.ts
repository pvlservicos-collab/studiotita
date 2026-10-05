/**
 * Duração de um arquivo de vídeo/áudio, lida pelo próprio ffmpeg
 * (o ffmpeg-static não traz o ffprobe, então a gente lê do texto de saída).
 */
import { spawn } from "node:child_process";

export function duracaoDoArquivo(caminho: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ffmpeg = require("ffmpeg-static") as string;
  return new Promise((resolve) => {
    const proc = spawn(ffmpeg, ["-i", caminho], { stdio: ["ignore", "ignore", "pipe"] });
    let texto = "";
    proc.stderr.on("data", (b: Buffer) => (texto += b.toString()));
    proc.on("close", () => {
      const m = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(texto);
      resolve(m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0);
    });
    proc.on("error", () => resolve(0));
  });
}
