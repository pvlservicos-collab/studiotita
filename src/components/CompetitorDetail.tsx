"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui";
import VideoBrowser from "@/components/VideoBrowser";
import { formatCount } from "@/lib/metricLabels";
import type { CompetitorRow } from "@/lib/types";

type OwnStats = { avg_views: number | null; avg_likes: number | null; avg_comments: number | null };

export default function CompetitorDetail({ id }: { id: string }) {
  const router = useRouter();
  const [competitor, setCompetitor] = useState<CompetitorRow | null>(null);
  const [own, setOwn] = useState<OwnStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [limit, setLimit] = useState(50);
  const [reloadToken, setReloadToken] = useState(0);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/competitors/${id}`);
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setCompetitor(data.competitor);
    setOwn(data.own);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function sync() {
    setSyncing(true);
    setSyncNote(null);
    try {
      const res = await fetch(`/api/competitors/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSyncNote(`${data.videos_salvos} vídeos atualizados${data.videos_sem_arquivo ? ` · ${data.videos_sem_arquivo} sem arquivo liberado pela Meta` : ""}.`);
      setReloadToken((t) => t + 1);
      load();
    } catch (err) {
      setSyncNote((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function remove() {
    if (!competitor || !confirm(`Remover @${competitor.username} e todos os vídeos e análises dele?`)) return;
    await fetch(`/api/competitors/${id}`, { method: "DELETE" });
    router.push("/concorrencia");
  }

  if (error) return <GlassCard className="p-6 text-sm text-rose-600">{error}</GlassCard>;
  if (!competitor) return <div className="p-8 text-center text-sm text-ink-400">Carregando...</div>;

  const compare = [
    { label: "Views médias", theirs: competitor.avg_views, ours: own?.avg_views },
    { label: "Curtidas médias", theirs: competitor.avg_likes, ours: own?.avg_likes },
    { label: "Comentários médios", theirs: competitor.avg_comments, ours: own?.avg_comments },
  ];

  return (
    <div className="space-y-6">
      <Link href="/concorrencia" className="text-sm text-ink-500 hover:text-gold-700">
        ← Concorrência
      </Link>

      <GlassCard strong className="flex flex-wrap items-start gap-5 p-5">
        {competitor.profile_picture_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={competitor.profile_picture_url} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-gold-300" />
        )}
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-ink-900">@{competitor.username}</h1>
            <a href={`https://www.instagram.com/${competitor.username}/`} target="_blank" rel="noopener noreferrer" className="text-xs text-gold-600 hover:underline">
              abrir no Instagram ↗
            </a>
          </div>
          {competitor.name && <div className="text-sm text-ink-600">{competitor.name}</div>}
          {competitor.biography && <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs text-ink-500">{competitor.biography}</p>}
        </div>
        <div className="flex gap-6 text-right">
          {[
            { label: "Seguidores", value: competitor.followers_count },
            { label: "Posts", value: competitor.media_count },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-semibold text-ink-900">{formatCount(s.value, false)}</div>
              <div className="text-xs text-ink-500">{s.label}</div>
            </div>
          ))}
        </div>
      </GlassCard>

      <div className="grid gap-3 sm:grid-cols-3">
        {compare.map((c) => (
          <GlassCard key={c.label} className="p-4">
            <div className="text-xs text-ink-500">{c.label} (últimos 30 vídeos)</div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-xl font-semibold text-ink-900">{formatCount(c.theirs ?? null)}</span>
              <span className="text-xs text-ink-500">você: {formatCount(c.ours ?? null)}</span>
            </div>
          </GlassCard>
        ))}
      </div>

      <VideoBrowser
        scopeQuery={`scope=competitor&competitor_id=${id}`}
        reloadToken={reloadToken}
        emptyDescription="Clique em Atualizar vídeos para buscar os posts deste concorrente."
        metricsNote={`De concorrentes a Meta informa views, curtidas e comentários. Salvamentos, compartilhamentos e alcance só existem na conta do Augusto.${syncNote ? ` · ${syncNote}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={remove} className="rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
              Remover
            </button>
            <div className="flex items-center overflow-hidden rounded-xl">
              <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="h-full border border-r-0 border-gold-300 bg-white/80 px-2 py-2 text-sm text-ink-700 outline-none">
                {[50, 100, 200, 300].map((n) => (
                  <option key={n} value={n}>
                    {n} posts
                  </option>
                ))}
              </select>
              <button onClick={sync} disabled={syncing} className="btn-gold px-4 py-2 text-sm font-semibold disabled:opacity-60">
                {syncing ? "Atualizando..." : "Atualizar vídeos"}
              </button>
            </div>
          </div>
        }
      />
    </div>
  );
}
