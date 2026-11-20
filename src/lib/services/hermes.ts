/**
 * Hermes: o agente na VPS do Titã com um Chrome logado no ChatGPT do Augusto.
 * Recebe um comando, manda no chat do projeto "Imagens Reels" (anexando as 4
 * fotos do rosto dele quando a imagem é dele) e devolve a imagem.
 * Código e operação em hermes/README.md.
 *
 * Na Vercel: HERMES_URL (https://titacrm.ascensaotita.com/hermes/api) e
 * HERMES_TOKEN (o mesmo de /docker/hermes/.env na VPS).
 */
export class HermesError extends Error {}

export type HermesResultado = {
  status: "pronto" | "gerando" | "na_fila" | "erro";
  job_id: string;
  etapa?: string;
  segundos?: number;
  imagem_url?: string;
  largura?: number;
  altura?: number;
  fotos_de_referencia_anexadas?: number;
  previa_base64?: string | null;
  texto_do_chatgpt?: string;
  chat_url?: string;
  aviso?: string;
  erro?: { code: string; message: string };
};

export const HERMES_TELA = "https://titacrm.ascensaotita.com/hermes/tela/vnc.html?path=hermes/tela/websockify&autoconnect=1&resize=scale";

// Cada chamada espera no máximo isso; depois volta job_id e o Claude chama de novo.
const ESPERA_S = 50;

export async function hermesGerar(input: { prompt?: string; usar_rosto_do_augusto?: boolean; chat_url?: string; job_id?: string }): Promise<HermesResultado> {
  const base = process.env.HERMES_URL?.replace(/\/+$/, "");
  const token = process.env.HERMES_TOKEN;
  if (!base || !token) {
    throw new HermesError("Hermes não configurado na Vercel: faltam HERMES_URL e/ou HERMES_TOKEN (o token está em /docker/hermes/.env na VPS do Titã).");
  }
  if (!input.job_id && !input.prompt?.trim()) throw new HermesError("Mande o prompt (o comando de criação da imagem).");

  let r: Response;
  try {
    r = await fetch(`${base}/gerar`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        prompt: input.job_id ? undefined : input.prompt,
        usar_rosto: input.usar_rosto_do_augusto,
        chat_url: input.chat_url,
        job_id: input.job_id,
        espera_s: ESPERA_S,
      }),
      signal: AbortSignal.timeout((ESPERA_S + 25) * 1000),
      cache: "no-store",
    });
  } catch (e) {
    throw new HermesError(`A VPS do Hermes não respondeu (${(e as Error).message}). Veja se o contêiner está de pé: ssh tita-vps "cd /docker/hermes && docker compose ps".`);
  }
  const d = (await r.json().catch(() => ({}))) as HermesResultado & { error?: string };
  if (!r.ok) throw new HermesError(`Hermes: ${d.error ?? r.statusText}`);
  if (d.status === "erro") {
    const precisaTela = ["nao_logado", "cloudflare"].includes(d.erro?.code ?? "");
    throw new HermesError(`Hermes: ${d.erro?.message ?? "falhou"}${precisaTela ? `\nO Pedro precisa entrar na tela do Hermes e resolver: ${HERMES_TELA}` : ""}`);
  }
  return d;
}
