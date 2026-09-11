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
    group: "Posts e métricas",
    tools: [
      { name: "list_videos", what: "Vídeos (do Augusto, de um concorrente ou de uma hashtag) com métricas, status da análise e categorias. Busca por palavra e ordenação por qualquer métrica." },
      { name: "get_best_posts", what: "Melhores posts de um período (30 dias, último mês, trimestre, semestre) por qualquer métrica." },
      { name: "get_posts_report", what: "Relatório em Markdown de todos os posts ou dos melhores: métricas + tudo o que o Gemini gerou (transcrição e frame a frame são opcionais)." },
      { name: "get_video", what: "Um vídeo com métricas completas e todas as análises." },
      { name: "sync_videos_from_meta", what: "Puxa os posts mais recentes do Augusto e atualiza as métricas (até 500)." },
      { name: "add_video", what: "Cadastra um vídeo manualmente pela URL." },
      { name: "get_account_metrics", what: "Métricas da conta ao vivo (1 a 28 dias): totais, alcance diário, formatos, público." },
    ],
  },
  {
    group: "Análises com o Gemini",
    tools: [
      { name: "get_default_prompt", what: "O prompt padrão enviado ao Gemini e o modelo em uso." },
      { name: "request_video_analysis", what: "Manda o vídeo ao Gemini: resumo, transcrição, estrutura, gancho, frame a frame e categorias." },
      { name: "analyze_missing_videos", what: "Dispara a análise em lote só nos vídeos que ainda não têm (os já analisados ficam de fora)." },
      { name: "get_analysis", what: "Status e conteúdo completo de uma análise (por video_id ou analysis_id)." },
      { name: "save_analysis_fields", what: "Preenche/edita resumo, transcrição, estrutura, gancho, categorias e adequação às regras do Augusto." },
    ],
  },
  {
    group: "Criar roteiro",
    tools: [
      { name: "create_script", what: "Gera um roteiro novo combinando melhores vídeos, categorias, concorrentes, assunto, trechos das aulas e cenas do Estúdio Reels (ou aleatório)." },
      { name: "list_video_scripts", what: "Roteiros extraídos dos vídeos analisados (Augusto e concorrentes): a biblioteca de referência." },
    ],
  },
  {
    group: "Categorias (curadoria)",
    tools: [
      { name: "list_categories", what: "Categorias geradas pelo Gemini, com os vídeos e quem está na seleção." },
      { name: "set_category_video", what: "Liga/desliga um vídeo da seleção de uma categoria." },
      { name: "get_category_scripts", what: "Roteiros (gancho + estrutura + transcrição) dos vídeos ligados da categoria." },
      { name: "generate_category_script", what: "Pede ao Gemini um roteiro novo da categoria, no método e na estrutura do Augusto. Salva em Roteiros." },
    ],
  },
  {
    group: "Roteiros",
    tools: [
      { name: "list_scripts", what: "Roteiros salvos (roteiro completo, gancho, estrutura, categoria, status)." },
      { name: "save_script", what: "Cria um roteiro, opcionalmente ligado a um vídeo e a uma categoria." },
      { name: "update_script", what: "Edita qualquer campo de um roteiro." },
      { name: "delete_scripts", what: "Exclui um ou vários roteiros." },
    ],
  },
  {
    group: "Concorrência",
    tools: [
      { name: "list_competitors", what: "Concorrentes com médias dos últimos 30 vídeos e as médias do Augusto para comparar." },
      { name: "add_competitors", what: "Adiciona concorrentes por link do Instagram ou @ (só contas profissionais)." },
      { name: "sync_competitor", what: "Atualiza perfil e vídeos de um concorrente (até 300)." },
      { name: "remove_competitor", what: "Remove um concorrente e os vídeos dele." },
      { name: "search_hashtag", what: "Posts em alta ou recentes de uma hashtag (limite da Meta: 30 hashtags diferentes/semana)." },
      { name: "list_hashtag_searches", what: "Hashtags já buscadas e a cota da semana." },
    ],
  },
  {
    group: "Biblioteca de arquivos",
    tools: [
      { name: "list_files", what: "Arquivos (método, briefing, transcrições de aula, roteiros antigos...). Busca no texto." },
      { name: "list_file_sections", what: "Os títulos (seções) de um arquivo, para pedir só a parte que interessa." },
      { name: "get_file_section", what: "O conteúdo de uma seção." },
      { name: "search_library", what: "Busca um termo em todas as seções da biblioteca, com trechos." },
      { name: "get_file", what: "Um arquivo com o texto (em partes, via max_chars/offset)." },
      { name: "save_text_file", what: "Salva um texto como arquivo novo (já dividido em títulos)." },
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
O app guarda os reels com as métricas da Meta, as análises do Gemini, os roteiros, a curadoria por categoria, a pesquisa de concorrentes e hashtags, e a biblioteca de arquivos do Augusto (método de roteiro, briefing, 5 volumes de Base de Ensino das aulas, referências científicas). Você tem acesso total: pode ler, criar, editar e apagar qualquer coisa, inclusive via SQL direto.

COMO O APP FUNCIONA
- Posts: sync_videos_from_meta atualiza os reels do Augusto. Cada vídeo tem colunas (views, reach, likes, comments, shares, saves) e o campo "metrics" com tudo o que a Meta informa: ${metricLegend}. Use esses números para decidir (salvamentos e compartilhamentos altos = conteúdo de valor; taxa de pulo alta = gancho fraco). get_best_posts faz o recorte "Melhores posts" por período; get_posts_report gera o relatório completo.
- Análises: request_video_analysis manda o vídeo ao Gemini. A resposta sempre volta em: summary (resumo), transcript (transcrição), structure (engenharia reversa de marketing: cada parte com os segundos, a função, o gatilho mental, a emoção e como foi construída, mais o arco da narrativa e os aprendizados para replicar), hook (gancho: fala, texto na tela, visual, duração e técnica), frames (leitura visual frame a frame, segundo a segundo: enquadramento, gestos, cenário, todo texto que aparece na tela, inserções e o tom da voz — é a base para montar as cenas do Estúdio Reels) e categories (temas).
- Dois tipos de roteiro: os EXTRAÍDOS dos vídeos (list_video_scripts: o que o Gemini tirou de cada vídeo analisado, do Augusto e dos concorrentes, guardados para sempre) e os GERADOS (list_scripts: criados pelo gerador, pelo Claude ou à mão). Cada roteiro gerado tem uma pontuação interna 0-100 pelos números dos vídeos de referência (ou do vídeo publicado, se estiver ligado a um).
- Criar roteiro: create_script combina fontes (melhores vídeos do período, busca por palavra nos vídeos analisados, categorias, concorrentes, assunto, trechos das aulas) ou random=true; scenes=true pede ideias de cena do Estúdio Reels (a ferramenta de telas do Augusto: números grandes, perguntas, listas, pentágono das 168h, agenda dos Faróis, gráficos, metas, mapa mental, sono). Esses campos são sempre gerados pelo Gemini. O prompt e o modelo usados ficam gravados. Leva ~30-60s; acompanhe com get_analysis. Cada análise consome a API do Gemini: só dispare quando o usuário pedir.
- Adequação às regras do Augusto (rules_fit): começa vazia. Preencha com save_analysis_fields quando o usuário pedir, comparando a transcrição com o método (arquivos de método e briefing da biblioteca).
- Categorias: vêm das análises. As do Augusto têm só o nome ("Política"); as de concorrentes e hashtags levam a origem ("@eslendelanogare+Política", "#tempo+Política"). list_categories mostra a curadoria; vídeos desligados (set_category_video) não entram em get_category_scripts nem em generate_category_script. generate_category_script usa os arquivos "prompt-roteiros-ascensao-tita.md" e "estrutura-roteiro-reel.md" da biblioteca.
- Concorrência: add_competitors aceita links/@ de contas profissionais. Os vídeos deles ficam em list_videos(scope="competitor", competitor_id=...) e podem ser analisados pelo Gemini como os do Augusto (se a Meta não liberar o arquivo por música licenciada, o usuário envia o vídeo pelo painel). De concorrentes e hashtags a Meta informa views/curtidas/comentários; salvamentos, compartilhamentos e alcance ficam nulos. search_hashtag: no máximo 30 hashtags DIFERENTES por 7 dias (repetir não gasta); confira a cota com list_hashtag_searches antes.
- Biblioteca: os arquivos estão divididos em seções com título (as Bases de Ensino têm ~2 mil passagens cada, com a sessão de origem "— S01"). Prefira search_library e get_file_section a ler arquivos inteiros. Siga as regras de fidelidade do arquivo "instrucoes_do_projeto.md": nunca invente falas do Augusto, cite verbatim.
- Roteiros: save_script / update_script / delete_scripts. Campos: title, full_script, hook (primeiros 3s), structure, status (draft|ready|published|archived), category, video_id opcional.
- Acesso total: get_db_schema + run_sql para qualquer consulta ou alteração; meta_graph_api para qualquer chamada à Meta. Atenção: POST/DELETE em meta_graph_api agem na conta real do Instagram, confirme com o usuário antes.

IDs: todos os ids internos são UUID. ig_media_id é o id do post na Meta.
Tudo o que você faz fica registrado na tabela integration_logs.`;

export function renderToolList() {
  return MCP_TOOL_GROUPS.map(
    (g) => `${g.group}:\n${g.tools.map((t) => `  - ${t.name}: ${t.what}`).join("\n")}`
  ).join("\n\n");
}
