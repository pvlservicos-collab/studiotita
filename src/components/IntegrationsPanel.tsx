"use client";

import { useEffect, useState } from "react";
import { GlassCard, Badge } from "@/components/ui";
import { MCP_TOOL_GROUPS } from "@/mcp/guide";

type SubTab = "status" | "mcp";

export default function IntegrationsPanel() {
  const [tab, setTab] = useState<SubTab>("mcp");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
          <span className="gold-gradient-text">Integrações</span>
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Como o Claude do Augusto se conecta a este sistema e o status de cada conexão.
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-full bg-white/60 p-1">
        {[
          { id: "mcp" as const, label: "Claude (MCP)" },
          { id: "status" as const, label: "Status do sistema" },
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

      {tab === "status" && <StatusTab />}
      {tab === "mcp" && <McpTab />}
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
  const [origin, setOrigin] = useState("https://studiotita.vercel.app");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    fetch("/api/integration-logs")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      <GlassCard strong className="p-5">
        <h3 className="mb-2 text-sm font-semibold text-ink-900">Como conectar o Claude do Augusto</h3>
        <p className="mb-3 text-sm text-ink-500">
          Rode este comando uma vez no terminal do Claude Code, trocando a chave pela MCP_API_KEY (ela não aparece
          aqui porque esta página é pública):
        </p>
        <pre className="scrollbar-thin overflow-x-auto rounded-xl bg-ink-900 p-4 text-xs text-gold-200">
{`claude mcp add --transport http --scope user videoteca-augusto ${origin}/api/mcp \\
  --header "Authorization: Bearer SUA_MCP_API_KEY" \\
  --header "X-Client-Name: augusto"`}
        </pre>
        <p className="mt-3 text-xs text-ink-400">
          Ao conectar, o Claude recebe automaticamente o guia do app. Ferramentas disponíveis:
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {MCP_TOOL_GROUPS.map((g) => (
            <div key={g.group}>
              <div className="mb-1 text-xs font-semibold text-ink-700">{g.group}</div>
              <ul className="space-y-1">
                {g.tools.map((t) => (
                  <li key={t.name} className="text-xs text-ink-500">
                    <code className="rounded bg-ink-100 px-1 text-ink-800">{t.name}</code> {t.what}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
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
