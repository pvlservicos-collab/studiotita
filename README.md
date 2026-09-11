# Videoteca IG — biblioteca de vídeos, roteiros e insights

Painel para organizar seus vídeos do Instagram, os roteiros (com gancho e
estrutura) e as análises de padrões que o Gemini gera para cada vídeo — com
os insights da Meta reunidos no mesmo lugar. O Claude Code do seu cliente se
conecta a este mesmo sistema via um servidor MCP embutido.

> **Importante:** este projeto foi gerado num ambiente sem acesso à internet
> para instalar pacotes, então `npm install` e `npm run build` **ainda não
> foram executados/verificados aqui**. Siga o passo a passo abaixo no seu
> computador — é o fluxo normal de qualquer projeto Next.js, mas leia a seção
> "Se algo não compilar de primeira" caso apareça algum erro de tipos.

## O que está incluso

- **Next.js 14 (App Router + TypeScript + Tailwind)** — painel branco/dourado
  com efeito glass.
- **3 abas**: Vídeos (tabela + botão "Pedir resumo" com barra de progresso e
  contador), Roteiros (card grande com o roteiro + 2 cards menores com gancho
  e estrutura + análise do Gemini embaixo) e Integrações (dados da Meta,
  status das conexões, instruções e logs do MCP).
- **Banco de dados Postgres** (`db/schema.sql`) pronto para o Neon, com
  tabelas para vídeos, roteiros, análises, insights da Meta e logs de
  integração.
- **Integração com a Meta Graph API** (`src/lib/meta.ts`) — traz vídeos/reels
  e insights da conta.
- **Integração com o Gemini** (`src/lib/gemini.ts`) — envia o vídeo pelo File
  API e pede resumo + padrões/roteiro identificado.
- **Servidor MCP** (`/api/mcp`) — é o que o Claude Code do seu cliente usa
  para consultar vídeos/roteiros, pedir análises e salvar roteiros.

## 1. Instalar dependências

```bash
npm install
```

## 2. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha no `.env.local`:

- `DATABASE_URL` — connection string do seu banco Neon (Vercel → Storage →
  criar Postgres/Neon → copiar a `DATABASE_URL`).
- `GEMINI_API_KEY` — crie em https://aistudio.google.com/apikey. Ajuste
  `GEMINI_MODEL` para o modelo de vídeo mais recente disponível na sua conta
  (o código já manda o vídeo pelo File API do Gemini).
- `FACEBOOK_ACCESS_TOKEN` e `FACEBOOK_IG_USER_ID` — veja o passo a passo
  abaixo.
- `BLOB_READ_WRITE_TOKEN` — opcional, só se quiser guardar cópias dos vídeos
  no Vercel Blob.
- `MCP_API_KEY` — uma chave forte (`openssl rand -hex 32`) que você vai
  entregar ao seu cliente para o Claude Code dele se conectar. **Enquanto
  essa variável não estiver definida, o endpoint `/api/mcp` fica aberto** —
  defina antes de dar acesso a alguém de verdade.

### Como pegar o token e o ID da Meta Graph API

1. Crie um app em https://developers.facebook.com/apps.
2. Adicione o produto "Instagram Graph API" e vincule a Página do Facebook
   conectada à sua conta profissional do Instagram.
3. No Graph API Explorer, gere um token de usuário com as permissões
   `instagram_basic`, `instagram_manage_insights` e `pages_show_list`, depois
   troque por um token de longa duração (60 dias) — ou gere um token de
   sistema (System User) se for usar em produção.
4. Descubra o `FACEBOOK_IG_USER_ID` chamando
   `GET /me/accounts` e depois `GET /{page-id}?fields=instagram_business_account`.

## 3. Criar as tabelas no banco

```bash
npm run db:migrate
```

Isso aplica `db/schema.sql` no banco apontado por `DATABASE_URL`. Pode rodar
de novo sem problema (usa `create table if not exists`).

## 4. Rodar localmente

```bash
npm run dev
```

Abra http://localhost:3000 — a aba **Vídeos** já deve carregar (vazia até
você sincronizar com a Meta ou adicionar um vídeo manualmente).

## 5. Conectar o Claude Code do cliente

Depois de publicar o projeto (ex.: na Vercel) e configurar `MCP_API_KEY`,
peça para o seu cliente rodar, uma vez, no terminal dele:

```bash
claude mcp add --transport http videoteca-ig https://SEU_DOMINIO/api/mcp \
  --header "Authorization: Bearer SUA_MCP_API_KEY" \
  --header "X-Client-Name: nome_do_cliente"
```

A partir daí o Claude Code dele ganha as ferramentas:

| Tool | O que faz |
|---|---|
| `list_videos` | Lista os vídeos com métricas e status da última análise |
| `get_video` | Detalhe de um vídeo + histórico de análises |
| `list_scripts` | Lista os roteiros salvos |
| `save_script` | Salva um roteiro novo (roteiro, gancho, estrutura) |
| `request_video_analysis` | Dispara a análise do Gemini para um vídeo |
| `get_analysis_status` | Consulta o status/resultado da análise |
| `get_meta_insights` | Últimos insights da conta do Instagram |

Toda chamada é registrada em `integration_logs` e aparece na aba
**Integrações → Claude Code (MCP)**. Se faltar alguma configuração (chave do
Gemini, token da Meta, etc.) ou algum dado (vídeo sem URL, id inexistente), a
resposta da tool já vem com uma mensagem clara dizendo o que é e onde
resolver — é por isso que os erros nas rotas (`src/lib/apiError.ts`) sempre
incluem um `code` e uma mensagem específica.

## 6. Publicar (Vercel)

```bash
vercel deploy
```

Configure as mesmas variáveis de ambiente do `.env.local` no painel da
Vercel (Project Settings → Environment Variables). Como você mencionou que
vai usar **Vercel Blob** e **Vercel Neon**: basta criar os dois no painel da
Vercel e colar as connection strings/tokens gerados automaticamente nas
variáveis `DATABASE_URL` e `BLOB_READ_WRITE_TOKEN`.

> Nota sobre o processamento em background da análise: o código dispara a
> chamada ao Gemini sem travar a resposta (`fire-and-forget`), o que funciona
> bem com `next start` (processo long-running). Em runtime serverless da
> Vercel, uma função pode encerrar assim que a resposta é enviada — se isso
> acontecer em produção, mova o processamento de `src/lib/services/analyses.ts`
> para uma fila (Vercel Queues, QStash, etc.) ou habilite `after()` do
> Next.js quando disponível na versão que você estiver usando.

## Estrutura do projeto

```
db/schema.sql              schema do Postgres (rode via npm run db:migrate)
src/lib/db.ts               conexão com o Postgres
src/lib/meta.ts             integração com a Facebook Graph API
src/lib/gemini.ts           integração com o Gemini (File API + análise)
src/lib/blob.ts             upload opcional pro Vercel Blob
src/lib/services/*          regras de negócio (vídeos, roteiros, análises, insights)
src/app/api/*               rotas HTTP usadas pela UI
src/app/api/mcp/route.ts    servidor MCP para o Claude Code do cliente
src/mcp/tools.ts            definição das tools do MCP
src/components/*            UI (TopNav, VideoLibrary, ScriptsBoard, IntegrationsPanel)
```

## Se algo não compilar de primeira

Este projeto foi escrito à mão (sem rodar `npm install`/`next build` no
ambiente onde foi gerado, por falta de acesso à internet ali). O código segue
as APIs oficiais do Next.js 14, `pg`, `@vercel/blob`, `mcp-handler` e
`@modelcontextprotocol/sdk`, mas se o `npm run build` apontar algum erro de
tipos (comum quando uma lib lança uma versão nova com assinatura levemente
diferente), normalmente basta:

1. Rodar `npm install` de novo e olhar a versão instalada de `mcp-handler` e
   `@modelcontextprotocol/sdk` — se a API de `createMcpHandler`/`registerTool`
   mudou, ajuste `src/app/api/mcp/route.ts` e `src/mcp/tools.ts` conforme a
   documentação da versão instalada.
2. Colar o erro do `npm run build` numa conversa com o Claude (Claude Code ou
   aqui mesmo) pedindo para corrigir — é rápido de resolver com o log de erro
   em mãos.
