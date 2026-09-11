/**
 * Guia do app para o Claude do Augusto. Vai nas instruções do servidor MCP
 * (recebidas ao conectar), na tool get_app_guide e na aba Integrações —
 * uma fonte só, para os três nunca divergirem.
 */
import { VIDEO_METRICS } from "@/lib/metricLabels";

export const MCP_TOOL_GROUPS: { group: string; tools: { name: string; what: string }[] }[] = [
  {
    group: "Guia",
    tools: [{ name: "get_app_guide", what: "Este guia + contagens atuais do banco." }],
  },
  {
    group: "Vídeos e métricas",
    tools: [
      { name: "list_videos", what: "Vídeos com todas as métricas da Meta e o status da última análise. Ordena por qualquer métrica." },
      { name: "get_video", what: "Um vídeo com métricas completas e todas as análises (resumo, transcrição, adequação, prompt)." },
      { name: "sync_videos_from_meta", what: "Puxa os posts mais recentes do Instagram e atualiza as métricas (até 500)." },
      { name: "add_video", what: "Cadastra um vídeo manualmente pela URL." },
      { name: "get_account_metrics", what: "Métricas da conta ao vivo (1 a 28 dias): totais, alcance diário, formatos, público." },
    ],
  },
  {
    group: "Análises com o Gemini",
    tools: [
      { name: "get_default_prompt", what: "O prompt padrão enviado ao Gemini e o modelo em uso." },
      { name: "request_video_analysis", what: "Manda o vídeo ao Gemini (prompt padrão ou personalizado). Resposta em resumo + transcrição." },
      { name: "get_analysis", what: "Status e conteúdo completo de uma análise (por video_id ou analysis_id)." },
      { name: "save_analysis_fields", what: "Preenche/edita resumo, transcrição e adequação às regras do Augusto. Cria a análise se o vídeo não tiver." },
    ],
  },
  {
    group: "Roteiros",
    tools: [
      { name: "list_scripts", what: "Roteiros salvos (roteiro completo, gancho, estrutura, status)." },
      { name: "save_script", what: "Cria um roteiro, opcionalmente ligado a um vídeo." },
      { name: "update_script", what: "Edita qualquer campo de um roteiro." },
    ],
  },
  {
    group: "Biblioteca de arquivos",
    tools: [
      { name: "list_files", what: "Arquivos da biblioteca (roteiros antigos, transcrições de aula...). Busca no texto." },
      { name: "get_file", what: "Um arquivo com o texto completo extraído." },
      { name: "save_text_file", what: "Salva um texto como arquivo novo na biblioteca." },
      { name: "update_file", what: "Edita nome, categoria, descrição ou texto de um arquivo." },
      { name: "delete_file", what: "Apaga um arquivo (banco + Blob)." },
    ],
  },
  {
    group: "Acesso total",
    tools: [
      { name: "get_db_schema", what: "Todas as tabelas e colunas do banco Postgres." },
      { name: "run_sql", what: "Executa qualquer SQL no banco (leitura e escrita, sem restrição)." },
      { name: "meta_graph_api", what: "Chamada livre à Graph API da Meta com o token da Página (tudo o que as permissões liberam)." },
    ],
  },
];

const metricLegend = VIDEO_METRICS.map(
  (m) => `${m.key} = ${m.label}${m.unit === "ms" ? " (milissegundos)" : m.unit === "percent" ? " (%)" : ""}`
).join("; ");

export const MCP_INSTRUCTIONS = `Você está conectado à Videoteca do Augusto (studiotita.vercel.app): a central de conteúdo do Instagram @augustotita.
O app guarda os reels com as métricas da Meta, as análises do Gemini (resumo + transcrição), os roteiros e uma biblioteca de arquivos (roteiros antigos, transcrições de aula). Você tem acesso total: pode ler, criar, editar e apagar qualquer coisa, inclusive via SQL direto.

COMO O APP FUNCIONA
- Vídeos: sync_videos_from_meta atualiza os reels e as métricas. Cada vídeo tem colunas principais (views, reach, likes, comments, shares, saves) e o campo "metrics" com tudo o que a Meta informa: ${metricLegend}. Use esses números para decidir o que funciona (ex.: salvamentos e compartilhamentos altos = conteúdo de valor; taxa de pulo alta = gancho fraco).
- Análises: request_video_analysis manda o vídeo ao Gemini. O prompt é livre (use get_default_prompt para ver o padrão), mas a resposta sempre volta em dois campos: summary (resumo) e transcript (transcrição). O prompt e o modelo usados ficam gravados na análise. Leva ~30-60s; acompanhe com get_analysis. Cada análise custa uso da API do Gemini: só dispare quando o usuário pedir.
- Adequação às regras do Augusto (campo rules_fit): começa vazio. Preencha com save_analysis_fields quando o usuário pedir, comparando o vídeo/transcrição com as regras do Augusto (procure as regras na biblioteca com list_files ou pergunte ao usuário).
- Roteiros: save_script / update_script. Campos: title, full_script, hook (primeiros 3s), structure, status (draft|ready|published|archived), video_id opcional.
- Biblioteca: list_files busca no nome e no texto; get_file traz o texto completo. Use como referência de estilo e conteúdo do Augusto ao escrever roteiros.
- Métricas da conta: get_account_metrics(days).
- Acesso total: get_db_schema + run_sql para qualquer consulta ou alteração; meta_graph_api para qualquer chamada à Meta (comentários, público, publicação...). Atenção: POST/DELETE em meta_graph_api agem na conta real do Instagram.

IDs úteis: todos os ids internos são UUID. ig_media_id é o id do post na Meta.
Tudo o que você faz fica registrado na tabela integration_logs.`;

export function renderToolList() {
  return MCP_TOOL_GROUPS.map(
    (g) => `${g.group}:\n${g.tools.map((t) => `  - ${t.name}: ${t.what}`).join("\n")}`
  ).join("\n\n");
}
