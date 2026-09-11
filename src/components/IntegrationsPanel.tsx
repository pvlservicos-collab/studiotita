"use client";

import { useEffect, useState } from "react";
import { GlassCard, Badge, EmptyState } from "@/components/ui";
import type { MetaInsightRow } from "@/lib/types";

type SubTab = "meta" | "status" | "mcp";

const METRIC_LABELS: Record<string, string> = {
  reach: "Alcance (dia)",
  views: "Visualizações (dia)",
  accounts_engaged: "Contas engajadas (dia)",
  total_interactions: "Interações (dia)",
  profile_views: "Visitas ao perfil (dia)",
  follower_count: "Novos seguidores (dia)",
  followers_count: "Seguidores (total)",
  follows_count: "Seguindo",
  media_count: "Publicações",
  website_clicks: "Cliques no site (dia)",
};

export default function IntegrationsPanel() {
  const [tab, setTab] = useState<SubTab>("meta");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
          <span className="gold-gradient-text">Integrações</span>
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Dados da Meta, status das conexões e como o Claude Code do seu cliente se conecta a este sistema.
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-full bg-white/60 p-1">
        {[
          { id: "meta" as const, label: "Meta / Instagram" },
          { id: "status" as const, label: "Status do sistema" },
          { id: "mcp" as const, label: "Claude Code (MCP)" },
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

      {tab === "meta" && <MetaTab />}
      {tab === "status" && <StatusTab />}
      {tab === "mcp" && <McpTab />}
    </div>
  );
}

function MetaTab() {
  const [insights, setInsights] = useState<MetaInsightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meta");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar insights.");
      setInsights(data.insights);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function sync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/meta", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao sincronizar com a Meta.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={sync} disabled={syncing} className="btn-gold rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
          {syncing ? "Sincronizando..." : "Sincronizar agora"}
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-ink-400">Carregando...</div>
      ) : error ? (
        <GlassCard className="p-5 text-sm text-rose-600">{error}</GlassCard>
      ) : insights.length === 0 ? (
        <EmptyState
          title="Sem dados da Meta ainda"
          description="Configure FACEBOOK_ACCESS_TOKEN e FACEBOOK_IG_USER_ID no .env.local e clique em 'Sincronizar agora'."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {insights.map((m) => (
            <GlassCard key={m.id} className="p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-ink-400">
                {METRIC_LABELS[m.metric] || m.metric}
              </div>
              <div className="mt-1 text-2xl font-semibold text-ink-900">
                {m.value != null ? new Intl.NumberFormat("pt-BR").format(m.value) : "—"}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusTab() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-sm text-ink-400">Verificando...</div>;

  const items = [
    { key: "database", label: "Banco de dados (Neon)", envVar: "DATABASE_URL" },
    { key: "gemini", label: "Gemini (análise de vídeo)", envVar: "GEMINI_API_KEY" },
    { key: "meta", label: "Meta Graph API", envVar: "FACEBOOK_ACCESS_TOKEN / FACEBOOK_IG_USER_ID" },
    { key: "blob", label: "Vercel Blob (cópias de vídeo)", envVar: "BLOB_READ_WRITE_TOKEN" },
    { key: "mcp", label: "Autenticação do MCP", envVar: "MCP_API_KEY" },
  ];

  return (
    <GlassCard strong className="divide-y divide-ink-100 p-2">
      {items.map((item) => {
        const ok = status?.integrations?.[item.key];
        return (
          <div key={item.key} className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-ink-800">{item.label}</div>
              <div className="text-xs text-ink-400">env: {item.envVar}</div>
            </div>
            <Badge tone={ok ? "success" : "warning"}>{ok ? "Configurado" : "Pendente"}</Badge>
          </div>
        );
      })}
    </GlassCard>
  );
}

function McpTab() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/integration-logs")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      <GlassCard strong className="p-5">
        <h3 className="mb-2 text-sm font-semibold text-ink-900">Como conectar o Claude Code do cliente</h3>
        <p className="mb-3 text-sm text-ink-500">
          Envie ao seu cliente a URL do sistema publicado e a chave de acesso (MCP_API_KEY). Ele roda este comando no
          terminal, uma vez:
        </p>
        <pre className="scrollbar-thin overflow-x-auto rounded-xl bg-ink-900 p-4 text-xs text-gold-200">
{`claude mcp add --transport http videoteca-ig https://SEU_DOMINIO/api/mcp \\
  --header "Authorization: Bearer SUA_MCP_API_KEY" \\
  --header "X-Client-Name: nome_do_cliente"`}
        </pre>
        <p className="mt-3 text-xs text-ink-400">
          A partir daí, o Claude Code dele ganha as ferramentas: list_videos, get_video, list_scripts, save_script,
          request_video_analysis, get_analysis_status e get_meta_insights.
        </p>
      </GlassCard>

      <GlassCard strong className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-ink-900">Últimas chamadas via MCP</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-ink-400">Nenhuma chamada registrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <Badge tone={log.status === "ok" ? "success" : "error"}>{log.status}</Badge>
                  <span className="font-medium text-ink-700">{log.tool}</span>
                  <span className="text-ink-400">de {log.actor}</span>
                </div>
                <span className="text-ink-400">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
