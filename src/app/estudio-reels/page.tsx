"use client";

import { useState } from "react";
import StudioFlowsPanel from "@/components/StudioFlowsPanel";

/** O Estúdio Reels do Augusto (public/estudio-reels.html), dentro do painel. */
export default function EstudioReelsPage() {
  const [fluxo, setFluxo] = useState<string | null>(null);
  const src = fluxo ? `/estudio-reels.html?fluxo=${fluxo}` : "/estudio-reels.html";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
            Estúdio <span className="gold-gradient-text">Reels</span>
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            As telas que entram na metade de baixo dos vídeos do Augusto. Cada vídeo analisado já vem com a{" "}
            <strong>metadinha</strong> montada pelo sistema, no padrão dos fluxos que ele usou — abra qualquer uma aqui.
          </p>
        </div>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-gold-300 bg-white px-4 py-2 text-sm font-semibold text-gold-700 hover:bg-gold-50"
        >
          Abrir em tela cheia ↗
        </a>
      </div>

      <StudioFlowsPanel onOpen={(id) => setFluxo(id)} />

      <iframe
        key={src}
        src={src}
        title="Estúdio Reels"
        className="h-[calc(100vh-220px)] min-h-[560px] w-full rounded-2xl border border-ink-200 bg-black shadow-glass"
      />
    </div>
  );
}
