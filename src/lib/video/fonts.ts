/**
 * As fontes que o vídeo pode usar.
 *
 * A "Fonte do Augusto" é a serifada que ele usa nas chamadas dos reels
 * ("Organização pessoal em menos de 3 minutos"). Como não dá para ter certeza
 * absoluta do arquivo original só olhando o vídeo, aqui ficam também as
 * serifadas mais parecidas: se você bater o olho e uma casar melhor, é só
 * escolher — ou trocar o `css` desta primeira entrada, que ela passa a valer
 * em tudo (legendas, textos e telas futuras).
 *
 * Para o canvas desenhar com a fonte certa, ela precisa estar CARREGADA antes
 * (garantirFontes). Senão o navegador desenha com a fonte de sistema e o vídeo
 * exportado sai diferente da prévia.
 */

export interface FonteVideo {
  id: string;
  nome: string;
  /** o que vai no ctx.font do canvas e no CSS */
  css: string;
  /** família do Google Fonts (para carregar) */
  google?: string;
  tipo: "serifada" | "sem serifa";
}

export const FONTES: FonteVideo[] = [
  {
    id: "augusto",
    nome: "Fonte do Augusto",
    css: '"EB Garamond", "Cormorant Garamond", Georgia, "Times New Roman", serif',
    google: "EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400",
    tipo: "serifada",
  },
  {
    id: "cormorant",
    nome: "Cormorant (serifada fina)",
    css: '"Cormorant Garamond", "EB Garamond", Georgia, serif',
    google: "Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,400",
    tipo: "serifada",
  },
  {
    id: "playfair",
    nome: "Playfair (serifada marcante)",
    css: '"Playfair Display", Georgia, serif',
    google: "Playfair+Display:ital,wght@0,400;0,600;0,700;1,400",
    tipo: "serifada",
  },
  {
    id: "lora",
    nome: "Lora (serifada redonda)",
    css: '"Lora", Georgia, serif',
    google: "Lora:ital,wght@0,400;0,600;0,700;1,400",
    tipo: "serifada",
  },
  {
    id: "estudio",
    nome: "Lato (a do Estúdio Reels)",
    css: '"Lato", "Inter", system-ui, sans-serif',
    google: "Lato:ital,wght@0,300;0,400;0,700;1,400",
    tipo: "sem serifa",
  },
  {
    id: "montserrat",
    nome: "Montserrat (legenda grossa)",
    css: '"Montserrat", system-ui, sans-serif',
    google: "Montserrat:ital,wght@0,500;0,700;0,800;1,500",
    tipo: "sem serifa",
  },
  {
    id: "inter",
    nome: "Inter (neutra)",
    css: '"Inter", system-ui, sans-serif',
    google: "Inter:wght@400;600;700",
    tipo: "sem serifa",
  },
];

export const FONTE_PADRAO = "augusto";

export function acharFonte(id: string | undefined | null): FonteVideo {
  return FONTES.find((f) => f.id === id) ?? FONTES[0];
}

export function cssDaFonte(id: string | undefined | null) {
  return acharFonte(id).css;
}

/** O endereço do Google Fonts com todas as famílias (vai no <head>). */
export function googleFontsHref() {
  const familias = FONTES.filter((f) => f.google).map((f) => `family=${f.google}`);
  return `https://fonts.googleapis.com/css2?${familias.join("&")}&display=swap`;
}

/**
 * Garante que as fontes estão carregadas antes de desenhar no canvas.
 * Chame antes da prévia e, principalmente, antes de exportar.
 */
export async function garantirFontes(ids: (string | undefined | null)[] = []) {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const alvos = ids.length ? ids : FONTES.map((f) => f.id);
  const pedidos: Promise<unknown>[] = [];
  for (const id of alvos) {
    const css = cssDaFonte(id);
    for (const peso of [300, 400, 700]) {
      pedidos.push((document as any).fonts.load(`${peso} 64px ${css}`).catch(() => undefined));
    }
  }
  await Promise.all(pedidos);
  await (document as any).fonts.ready;
}
