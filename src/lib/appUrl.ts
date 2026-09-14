/**
 * Endereço público do app. Usado nos links que o Claude do Augusto manda na
 * conversa (a página da metadinha e o estúdio já com o fluxo aberto).
 *
 * Defina APP_URL no .env quando o domínio mudar; na Vercel, o domínio de
 * produção já vem por variável de ambiente.
 */
export function appUrl() {
  const bruto =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://studiotita.vercel.app";
  return bruto.replace(/\/+$/, "");
}

/** Links de uma metadinha: a página para ver e o estúdio para editar. */
export function flowLinks(id: string) {
  const base = appUrl();
  return {
    ver: `${base}/metadinha/${id}`,
    abrir_no_estudio: `${base}/estudio-reels.html?fluxo=${id}`,
  };
}
