import Link from "next/link";
import { notFound } from "next/navigation";
import MetadinhaPage from "@/components/MetadinhaPage";
import { getStudioFlow } from "@/lib/services/studioFlows";
import type { StudioScene } from "@/lib/studio/scenes";

export const dynamic = "force-dynamic";

/**
 * Página de uma metadinha: a prévia das telas, a instrução de cada cena e o
 * botão para abrir no estúdio. É o link que o Claude do Augusto manda quando
 * ele pede uma metadinha na conversa.
 */
export default async function Metadinha({ params }: { params: { id: string } }) {
  const flow = await getStudioFlow(params.id);
  if (!flow) notFound();

  const cenas = ((flow.scenes as StudioScene[] | null) ?? []).filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-gold-600">
            Metadinha do Estúdio Reels {flow.kind === "referencia" ? "· fluxo do Augusto" : "· montada pelo sistema"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">{flow.title}</h1>
          {flow.video_caption && (
            <p className="mt-1 text-sm text-ink-500">
              Vídeo: {flow.video_caption.split("\n")[0].slice(0, 90)}
              {flow.video_permalink && (
                <>
                  {" · "}
                  <a href={flow.video_permalink} target="_blank" rel="noopener noreferrer" className="text-gold-600 hover:underline">
                    ver no Instagram
                  </a>
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/estudio-reels.html?fluxo=${flow.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold rounded-xl px-4 py-2 text-sm font-semibold"
          >
            Abrir no Estúdio ↗
          </a>
          <Link
            href="/estudio-reels"
            className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            Todos os fluxos
          </Link>
        </div>
      </div>

      {flow.summary && (
        <p className="whitespace-pre-wrap rounded-2xl bg-white/70 p-4 text-sm leading-relaxed text-ink-700">{flow.summary}</p>
      )}

      {cenas.length === 0 ? (
        <p className="text-sm text-ink-500">
          Esta metadinha ainda não tem cenas{flow.status === "error" ? ` (erro: ${flow.error_message})` : ""}.
        </p>
      ) : (
        <MetadinhaPage cenas={cenas} />
      )}
    </div>
  );
}
