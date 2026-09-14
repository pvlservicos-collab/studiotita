/**
 * As telas da metadinha viradas em clipes da linha do tempo.
 * Fica separado do serviço porque o editor (navegador) usa a mesma função
 * quando você manda "puxar as telas da metadinha" de novo.
 */
import type { StudioScene } from "@/lib/studio/scenes";
import { novoId, paraSegundos, type TelaClip } from "@/lib/video/types";

export function telasDoFluxo(cenas: StudioScene[], duracao: number): TelaClip[] {
  const validas = (cenas ?? []).filter(Boolean);
  if (!validas.length) return [];
  const temTempo = validas.some((c) => c.inicio);

  return validas.map((cena, i) => {
    let inicio: number;
    let fim: number;
    if (temTempo) {
      inicio = paraSegundos(cena.inicio, i * 10);
      const proxima = validas[i + 1];
      fim = cena.fim
        ? paraSegundos(cena.fim, inicio + 10)
        : proxima
        ? paraSegundos(proxima.inicio, inicio + 10)
        : duracao || inicio + 10;
    } else {
      const fatia = (duracao || validas.length * 10) / validas.length;
      inicio = i * fatia;
      fim = (i + 1) * fatia;
    }
    if (duracao && fim > duracao) fim = duracao;
    return {
      id: novoId(),
      inicio: Number(inicio.toFixed(2)),
      fim: Number(Math.max(inicio + 0.5, fim).toFixed(2)),
      cena,
    };
  });
}
