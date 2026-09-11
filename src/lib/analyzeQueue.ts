/**
 * Fila de análises no navegador: manda os vídeos ao Gemini, 3 por vez,
 * esperando cada um terminar. Usada no relatório e na seleção em massa.
 */
export async function analyzeQueue(
  videoIds: string[],
  onProgress: (state: { done: number; failed: number; total: number }) => void,
  concurrency = 3
) {
  const queue = [...videoIds];
  const state = { done: 0, failed: 0, total: queue.length };
  onProgress({ ...state });

  const runOne = async (id: string) => {
    try {
      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ video_id: id, requested_by: "pedro" }),
      });
      if (!res.ok) throw new Error();
      for (let i = 0; i < 100; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        const s = await fetch(`/api/analyses/${id}`).then((r) => r.json());
        if (s.analysis?.status === "done") {
          state.done++;
          return;
        }
        if (s.analysis?.status === "error") throw new Error();
      }
      throw new Error();
    } catch {
      state.failed++;
    } finally {
      onProgress({ ...state });
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length) await runOne(queue.shift()!);
    })
  );
  return state;
}
