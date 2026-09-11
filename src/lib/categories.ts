/**
 * Nomes de categoria: o Gemini pode escrever "gestão de tempo" num vídeo e
 * "Gestão de Tempo" noutro. Guardamos com a primeira letra maiúscula e
 * agrupamos por uma chave sem acento e sem caixa.
 */

export function normalizeCategory(name: string) {
  const clean = name.replace(/\s+/g, " ").replace(/^[#"'“”\s]+|["'“”.\s]+$/g, "").trim();
  return clean ? clean.charAt(0).toLocaleUpperCase("pt-BR") + clean.slice(1) : "";
}

export function categoryKey(name: string) {
  return normalizeCategory(name)
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function normalizeCategories(list: string[] | null | undefined) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list ?? []) {
    const name = normalizeCategory(raw);
    const key = categoryKey(name);
    if (name && !seen.has(key)) {
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}
