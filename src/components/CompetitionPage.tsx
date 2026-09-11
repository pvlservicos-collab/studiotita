"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard, EmptyState, ProgressBar } from "@/components/ui";
import VideoBrowser from "@/components/VideoBrowser";
import { formatCount } from "@/lib/metricLabels";
import type { CompetitorRow } from "@/lib/types";

type Tab = "concorrentes" | "hashtags";

export default function CompetitionPage() {
  const [tab, setTab] = useState<Tab>("concorrentes");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
          <span className="gold-gradient-text">Concorrência</span>
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Pesquisa pelos recursos oficiais da Meta: só leitura, feita quando você clica. Nada é publicado nem automatizado na sua conta.
        </p>
      </div>
      <div className="flex w-fit gap-1 rounded-full bg-white/60 p-1">
        {[
          { id: "concorrentes" as const, label: "Concorrentes" },
          { id: "hashtags" as const, label: "# Hashtags" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t.id ? "btn-gold" : "text-ink-500 hover:bg-white hover:text-ink-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "concorrentes" ? <CompetitorsTab /> : <HashtagsTab />}
    </div>
  );
}

type Own = { username: string; followers_count: number | null; profile_picture_url: string | null; avg_views: number | null; avg_likes: number | null; avg_comments: number | null; video_count: number };
type AddResult = { username: string; ok: boolean; error?: string; videos_salvos?: number; videos_sem_arquivo?: number };

function CompetitorsTab() {
  const [competitors, setCompetitors] = useState<CompetitorRow[]>([]);
  const [own, setOwn] = useState<Own | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [results, setResults] = useState<AddResult[]>([]);

  async function load() {
    const res = await fetch("/api/competitors");
    const data = await res.json();
    setCompetitors(data.competitors ?? []);
    setOwn(data.own ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    setAdding(true);
    setResults([]);
    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data.results);
      if (data.results.some((r: AddResult) => r.ok)) setInput("");
      load();
    } catch (err) {
      setResults([{ username: "", ok: false, error: (err as Error).message }]);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-5">
      <GlassCard strong className="space-y-3 p-5">
        <div className="text-sm font-semibold text-ink-900">Adicionar concorrentes</div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder={"Cole links do Instagram ou @usuarios, um por linha\nhttps://www.instagram.com/primorico/\n@joeljota"}
          className="w-full rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-gold-400"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-400">
            Só contas profissionais (comercial ou criador). De cada uma vêm os últimos 50 vídeos com views, curtidas e comentários.
          </p>
          <button onClick={add} disabled={adding || !input.trim()} className="btn-gold rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {adding ? "Buscando na Meta..." : "Adicionar"}
          </button>
        </div>
        {adding && <ProgressBar progress={0} indeterminate />}
        {results.length > 0 && (
          <ul className="space-y-1 text-xs">
            {results.map((r, i) => (
              <li key={i} className={r.ok ? "text-emerald-700" : "text-rose-600"}>
                {r.ok
                  ? `✓ @${r.username}: ${r.videos_salvos} vídeos salvos${r.videos_sem_arquivo ? ` (${r.videos_sem_arquivo} sem arquivo liberado pela Meta)` : ""}`
                  : `✗ ${r.username ? `@${r.username}: ` : ""}${r.error}`}
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {loading ? (
        <div className="p-8 text-center text-sm text-ink-400">Carregando...</div>
      ) : competitors.length === 0 ? (
        <EmptyState title="Nenhum concorrente ainda" description="Cole acima o link do Instagram de um concorrente para começar." />
      ) : (
        <GlassCard strong className="overflow-hidden">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs text-ink-400">
                  <th className="px-5 py-3 font-medium">Conta</th>
                  <th className="px-3 py-3 text-right font-medium">Seguidores</th>
                  <th className="px-3 py-3 text-right font-medium">Views médias*</th>
                  <th className="px-3 py-3 text-right font-medium">Curtidas médias*</th>
                  <th className="px-3 py-3 text-right font-medium">Coment. médios*</th>
                  <th className="px-3 py-3 text-right font-medium">Vídeos salvos</th>
                  <th className="px-5 py-3 text-right font-medium">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {own && (
                  <tr className="border-b border-gold-100 bg-gold-50/40">
                    <td className="px-5 py-3">
                      <AccountCell username={own.username} picture={own.profile_picture_url} note="você" />
                    </td>
                    <Num v={own.followers_count} />
                    <Num v={own.avg_views} />
                    <Num v={own.avg_likes} />
                    <Num v={own.avg_comments} />
                    <Num v={own.video_count} />
                    <td className="px-5 py-3 text-right text-xs text-ink-400">—</td>
                  </tr>
                )}
                {competitors.map((c) => (
                  <tr key={c.id} className="border-b border-ink-50 hover:bg-white/60">
                    <td className="px-5 py-3">
                      <Link href={`/concorrencia/${c.id}`} className="hover:text-gold-700">
                        <AccountCell username={c.username} picture={c.profile_picture_url} note={c.name ?? undefined} />
                      </Link>
                    </td>
                    <Num v={c.followers_count} />
                    <Num v={c.avg_views ?? null} />
                    <Num v={c.avg_likes ?? null} />
                    <Num v={c.avg_comments ?? null} />
                    <Num v={c.video_count ?? 0} />
                    <td className="px-5 py-3 text-right text-xs text-ink-400">
                      {c.last_synced_at ? new Date(c.last_synced_at).toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-xs text-ink-400">* médias dos últimos 30 vídeos de cada conta. Clique numa conta para ver os vídeos.</p>
        </GlassCard>
      )}
    </div>
  );
}

function AccountCell({ username, picture, note }: { username: string; picture: string | null; note?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={picture} alt="" className="h-8 w-8 rounded-full object-cover" />
      ) : (
        <span className="h-8 w-8 rounded-full bg-ink-100" />
      )}
      <div className="min-w-0">
        <div className="truncate font-medium text-ink-800">@{username}</div>
        {note && <div className="truncate text-xs text-ink-400">{note}</div>}
      </div>
    </div>
  );
}

function Num({ v }: { v: number | null }) {
  return <td className="px-3 py-3 text-right tabular-nums text-ink-700">{v == null ? "—" : formatCount(v, false)}</td>;
}

type Quota = { used: number; limit: number; hashtags_this_week: string[] };
type HistoryItem = { hashtag: string; last_searched_at: string; posts: number };

function HashtagsTab() {
  const [input, setInput] = useState("");
  const [edge, setEdge] = useState<"top_media" | "recent_media">("top_media");
  const [quota, setQuota] = useState<Quota | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  async function load() {
    const res = await fetch("/api/hashtags");
    const data = await res.json();
    setQuota(data.quota);
    setHistory(data.history ?? []);
    if (!active && data.history?.[0]) setActive(data.history[0].hashtag);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search(tag = input) {
    setSearching(true);
    setError(null);
    try {
      const res = await fetch("/api/hashtags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hashtag: tag, edge }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActive(data.hashtag);
      setInput("");
      setReloadToken((t) => t + 1);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  const normalized = input.trim().replace(/^#/, "").toLowerCase();
  const costsQuota = normalized && quota && !quota.hashtags_this_week.includes(normalized);

  return (
    <div className="space-y-5">
      <GlassCard strong className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center rounded-lg border border-ink-200 bg-white/70 px-3 focus-within:border-gold-400">
            <span className="text-ink-400">#</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && input.trim() && search()}
              placeholder="gestaodetempo"
              className="min-w-[160px] flex-1 bg-transparent px-1 py-2 text-sm outline-none"
            />
          </div>
          <select value={edge} onChange={(e) => setEdge(e.target.value as typeof edge)} className="rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-sm text-ink-700 outline-none">
            <option value="top_media">Em alta</option>
            <option value="recent_media">Recentes (24h)</option>
          </select>
          <button onClick={() => search()} disabled={searching || !input.trim()} className="btn-gold rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {searching ? "Buscando..." : "Buscar"}
          </button>
        </div>
        {quota && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-ink-500">
              <span>
                {quota.used} de {quota.limit} hashtags diferentes nos últimos 7 dias (limite da Meta)
              </span>
              {costsQuota ? <span className="text-amber-700">esta busca usa 1 da cota</span> : normalized ? <span>já buscada: não gasta cota</span> : null}
            </div>
            <ProgressBar progress={(quota.used / quota.limit) * 100} />
          </div>
        )}
        {error && <p className="text-xs text-rose-600">{error}</p>}
        {history.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {history.map((h) => (
              <button
                key={h.hashtag}
                onClick={() => setActive(h.hashtag)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${active === h.hashtag ? "btn-gold" : "bg-ink-100 text-ink-600 hover:bg-ink-200"}`}
              >
                #{h.hashtag} · {h.posts}
              </button>
            ))}
          </div>
        )}
      </GlassCard>

      {active ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink-900">#{active}</h2>
            <button onClick={() => search(active)} disabled={searching} className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-50">
              Atualizar posts desta hashtag
            </button>
          </div>
          <VideoBrowser
            scopeQuery={`scope=hashtag&tag=${encodeURIComponent(active)}`}
            reloadToken={reloadToken}
            hideBest
            metricsNote="Em posts de hashtag a Meta informa curtidas e comentários; views, salvamentos e compartilhamentos não."
          />
        </>
      ) : (
        <EmptyState title="Nenhuma hashtag buscada" description="Busque um tema para ver os posts em alta. Vídeos com arquivo liberado podem ser analisados pelo Gemini." />
      )}
    </div>
  );
}
