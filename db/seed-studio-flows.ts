/**
 * Carrega os FLUXOS DE REFERÊNCIA do Estúdio Reels: as metadinhas que o
 * Augusto montou de verdade, cada uma ligada ao vídeo em que foi usada.
 *
 * De onde vem cada fluxo:
 *  - As cenas do projeto salvo dentro do estúdio (public/estudio-reels.html,
 *    constante PADRAO). Essas são as telas originais, do jeito que ele montou:
 *    o projeto que vai para o banco é o recorte real daquelas cenas.
 *  - A leitura frame a frame das análises do Gemini, para os vídeos em que a
 *    tela existe no vídeo mas não está no projeto salvo (reconstrução).
 *
 * A ligação fluxo → vídeo foi feita comparando o conteúdo das cenas com o
 * frame a frame de cada vídeo (texto na tela, categorias e ordem das etapas).
 * A confiança de cada ligação fica gravada em link_confidence.
 *
 * Uso: npm run seed:fluxos        (pode rodar de novo: refaz os de referência)
 */
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { toStudioProject, type StudioScene } from "../src/lib/studio/scenes";

loadEnv({ path: path.join(__dirname, "..", ".env.local") });

// --------------------------------------------------- projeto salvo no estúdio

type PadraoScene = Record<string, any>;

function lerPadrao(): PadraoScene[] {
  const html = readFileSync(path.join(__dirname, "..", "public", "estudio-reels.html"), "utf-8");
  const linha = html.split("\n").find((l) => l.startsWith("const PADRAO = "));
  if (!linha) throw new Error("Não achei a constante PADRAO em public/estudio-reels.html");
  const json = JSON.parse(linha.slice("const PADRAO = ".length).replace(/;\s*$/, ""));
  return json.c as PadraoScene[];
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Uma cena do projeto do estúdio no formato de cena do app (para leitura e para servir de exemplo). */
function padraoParaCena(c: PadraoScene): StudioScene {
  const base: StudioScene = { tipo: "texto", titulo: c.titulo || undefined };
  if (c.tipo === "agenda") {
    base.tipo = "agenda";
    base.agenda = {
      recorte: c.aj?.dia != null ? "dia" : "semana",
      dia: c.aj?.dia,
      h0: c.aj?.h0,
      h1: c.aj?.h1,
      lista: Boolean(c.aj?.lista),
      titulo: c.agTit || undefined,
      nivel: c.nvAtual ?? undefined,
      blocos: (c.agb ?? []).map((b: any) => ({
        dia: b.dia,
        inicio: hhmm(b.ini),
        dur: b.dur,
        cat: b.cat,
        rot: b.rot ?? "",
        nv: b.nv,
      })),
      etapas: (c.age ?? []).map((e: any) => ({ nome: e.nome, cats: e.cats })),
    };
    if ((c.blocos ?? []).length) {
      base.linhas = c.blocos.map((b: any) => ({ txt: String(b.txt ?? "").replace(/<[^>]+>/g, " ").trim(), papel: "item" as const }));
    }
    return base;
  }
  if (c.tipo === "sono") {
    base.tipo = "sono";
    base.sono = { acorda: hhmm(c.sono?.acorda ?? 420), horas: Math.round((c.sono?.dur ?? 480) / 60) };
    return base;
  }
  if (c.tipo === "grafico") {
    base.tipo = "grafico";
    base.grafico = { qual: (c.graf?.qual ?? 2) as 1 | 2 | 3 };
    return base;
  }
  if (c.tipo === "pentagono" || c.tipo === "metas") {
    base.tipo = c.tipo;
    return base;
  }
  if (c.tipo === "mapa") {
    base.tipo = "mapa";
    base.mapa = { nos: (c.mapa?.nos ?? []).map((n: any) => ({ tipo: n.tipo, txt: String(n.txt ?? "").replace(/<[^>]+>/g, " ").trim() })) };
    return base;
  }
  base.linhas = (c.blocos ?? []).map((b: any) => ({
    txt: String(b.txt ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim(),
    papel: b.tam >= 70 ? ("numero" as const) : b.ita ? ("frase" as const) : b.neg ? ("destaque" as const) : ("apoio" as const),
  }));
  return base;
}

// --------------------------------------------------------------- os fluxos

interface Anotacao {
  inicio: string;
  fim: string;
  titulo: string;
  fala: string;
  instrucao: string;
  nota?: string;
}

interface FluxoSeed {
  /** código do reel no permalink, para achar o vídeo */
  reel: string;
  title: string;
  summary: string;
  link_confidence: "alta" | "media" | "baixa";
  link_reason: string;
  /** cenas do projeto embutido (1-based), na ordem em que aparecem no vídeo */
  padrao?: number[];
  /** uma anotação por cena do projeto */
  anotacoes?: Anotacao[];
  /** cenas que o vídeo tem mas o projeto não guardou (entram depois das do projeto) */
  extras?: StudioScene[];
  /** fluxo inteiro reconstruído do frame a frame (quando não há projeto salvo) */
  cenas?: StudioScene[];
}

const APP_CTA: StudioScene = {
  tipo: "chamada",
  titulo: "Plataforma + CTA 247",
  linhas: [
    { txt: "A Minha Agenda em Ascensão", papel: "destaque" },
    { txt: "Comenta 247", papel: "numero" },
  ],
  fala: "Eu montei uma plataforma que monta o planejamento da tua semana pra ti. Digita 247 que eu mando ela pra ti.",
  instrucao: "Fala o 247 devagar, duas vezes. Olha fixo para a câmera no fechamento.",
  nota: "No vídeo original esta parte é gravação de tela da plataforma (1 de 7 Sono, 2 de 7 Trabalho..., “Sua semana está montada”), não uma cena do estúdio.",
};

const FLUXOS: FluxoSeed[] = [
  {
    reel: "DdHo3mhy_Ff",
    title: "Os 7 níveis da organização pessoal (escada de níveis)",
    summary:
      "A mesma agenda evolui do nível 0 ao 7: cada nível acrescenta uma camada (compromissos com outros → to-do list → prazos → rotina/balizadores → timeboxing → coringa → eficiência) e o título em cima da agenda muda junto. O gancho é a animação correndo os níveis em loop antes de explicar.",
    link_confidence: "alta",
    link_reason:
      "As cenas de nível do projeto salvo batem uma a uma com o frame a frame: os títulos “Agenda da semana · Nível 0 · sem organização” até “Nível 7 · eficiência”, a lista roxa de to-do na lateral (nível 2), os blocos vermelhos de prazo (nível 3) e os amarelos de coringa (nível 6).",
    padrao: [11, 12, 13, 14, 15, 16, 17, 18, 19],
    anotacoes: [
      { inicio: "00:00", fim: "00:13", titulo: "Gancho: os 7 níveis em loop", fala: "Uma vida organizada é uma vida mais fácil. Então eu vou te mostrar quais são os sete níveis da organização pessoal.", instrucao: "Deixa a animação correr os níveis em loop enquanto fala o gancho; não explica nível nenhum ainda. Headline “Os 7 níveis da organização pessoal” por cima." },
      { inicio: "00:13", fim: "00:18", titulo: "Nível 0: sem organização", fala: "O nível zero é aquela pessoa que não se organiza nada, não tem agenda, nem conta.", instrucao: "Agenda vazia. Gesto de descarte com a mão, rápido." },
      { inicio: "00:18", fim: "00:31", titulo: "Nível 1: compromissos com outros", fala: "O nível um é quando tu coloca os compromissos que tu tem agendado com outras pessoas.", instrucao: "Os blocos laranjas entram. Circula um deles com a caneta." },
      { inicio: "00:31", fim: "00:43", titulo: "Nível 2: to-do list", fala: "No nível dois tu já começa a ter uma to-do list: tira da cabeça e coloca no papel.", instrucao: "A lista roxa aparece na lateral. Toca a têmpora ao falar em “tirar da cabeça”." },
      { inicio: "00:43", fim: "00:52", titulo: "Nível 3: prazos", fala: "No nível três tu inclui as tuas deadlines, os prazos de entrega.", instrucao: "Entram os blocos vermelhos. Circula um prazo com a caneta." },
      { inicio: "00:52", fim: "01:26", titulo: "Nível 4: rotina e balizadores", fala: "Aqui começa a se construir rotina: dormir, acordar, alimentação e treino. Eu chamo isso de balizadores, tipo as canaletas do boliche.", instrucao: "Entram sono, refeições e treino. Desenha círculos em volta dos blocos verdes e do sono enquanto fala em balizadores." },
      { inicio: "01:27", fim: "01:43", titulo: "Nível 5: timeboxing e batching", fala: "No nível cinco tu pega a tua to-do list e joga ela para dentro da agenda. Aqui também dá pra fazer batching.", instrucao: "As tarefas da lista deslizam para dentro dos horários vagos. Junta as palmas ao falar em agrupar." },
      { inicio: "01:44", fim: "02:16", titulo: "Nível 6: agenda realista + coringa", fala: "O nível seis é quando tu deixa a agenda realista, com tempo coringa para os imprevistos.", instrucao: "Entram os blocos amarelos. Circula um coringa com a caneta." },
      { inicio: "02:17", fim: "02:41", titulo: "Nível 7: eficiência", fala: "E no nível sete o foco é eficiência: as horas nas atividades que mais geram progresso, com rotina sustentável.", instrucao: "A grade fica equilibrada. Gesto de alinhamento; tom conclusivo." },
    ],
    extras: [APP_CTA],
  },
  {
    reel: "DcuNFSwSPc0",
    title: "As 112 horas: montar a semana em camadas",
    summary:
      "A semana inteira é construída do zero na frente de quem assiste, uma camada por passo do método: compromissos com outras pessoas, refeições e treino (os pilares), tempo coringa, prioridades, atividades e, no fim, os espaços em branco que precisam sobrar. É a metadinha de melhor desempenho da conta em salvamentos.",
    link_confidence: "alta",
    link_reason:
      "A cena de semana completa do projeto (sono, café/almoço/jantar, treino, coringa, prioridades e atividades) é exatamente a agenda que aparece no vídeo, e a ordem de revelação do frame a frame segue a mesma sequência de etapas do estúdio.",
    padrao: [3],
    anotacoes: [
      {
        inicio: "00:12",
        fim: "02:47",
        titulo: "A semana de 112 horas, camada por camada",
        fala: "Não tem como fazer mais coisas do que cabe em 112 horas. Começa pelos compromissos com outras pessoas, depois fixa almoço e treino, o tempo coringa, as prioridades e só então as outras atividades.",
        instrucao:
          "Revela na ordem: Dormir → Reunião → Refeições e treinos → Coringa → Prioridades → Atividade. Escreve “112” à mão na grade no começo; marca círculos nos horários fixos ao falar em pilares; no fim circula os espaços vazios que sobraram.",
      },
    ],
    extras: [
      {
        inicio: "00:00",
        fim: "00:12",
        tipo: "texto",
        titulo: "Headline do gancho",
        linhas: [{ txt: "Organização pessoal\nem menos de 3 minutos", papel: "destaque" }],
        fala: "Uma vida organizada é uma vida mais fácil. Em um minuto eu vou te mostrar como melhorar a tua organização pessoal.",
        instrucao: "A headline fica no centro da tela de baixo durante a apresentação e some quando a explicação começa.",
      },
      {
        inicio: "01:23",
        fim: "01:31",
        tipo: "texto",
        titulo: "Cartão de ressalva",
        linhas: [{ txt: "A vida real não é tão previsível assim,\nmas mantenha a regularidade quando der", papel: "apoio" }],
        fala: "E daí se eventualmente um dia tu precisar mudar, tu muda, mas tenta priorizar deixar isso fixo.",
        instrucao: "Cartão entra no centro por 6 a 8 segundos e sai. A agenda continua atrás.",
      },
      {
        inicio: "02:47",
        fim: "02:56",
        tipo: "chamada",
        titulo: "CTA de salvar",
        linhas: [{ txt: "Salva esse vídeo", papel: "destaque" }, { txt: "pra usar quando for planejar a semana", papel: "apoio" }],
        fala: "Salva esse vídeo pra quando tu for planejar o teu dia e a tua semana, tu lembrar dessa sequência.",
        instrucao: "Volta o olhar para a câmera; a agenda pronta fica na tela.",
      },
    ],
  },
  {
    reel: "DchfmdfyDR8",
    title: "A conta do sono (de trás pra frente)",
    summary:
      "Dentro do vídeo de 5 maneiras de dormir mais cedo, a tela do estúdio faz a conta de trás pra frente: hora de acordar → 8 horas de sono → 15 minutos para pegar no sono → 1 hora antes, o alarme “Preparar para dormir”. Cada etapa acende no ritmo da fala. É o vídeo de melhor desempenho da conta.",
    link_confidence: "alta",
    link_reason:
      "A cena de sono do projeto está configurada para acordar às 07:00 com 8 horas de sono, exatamente a conta que o frame a frame descreve (07:00, 23:00, 22:45 e o alarme às 21:45, com o título “Que horas ir pra cama? A conta é de trás pra frente”).",
    padrao: [7],
    anotacoes: [
      {
        inicio: "01:38",
        fim: "02:19",
        titulo: "Que horas ir pra cama?",
        fala: "Define o horário que tu quer acordar e conta 8 horas pra trás. Aí conta mais 15 minutos, que é o tempo pra pegar no sono. Conta mais uma hora e coloca um alarme escrito “Preparar para dormir”.",
        instrucao: "Uma etapa por frase: acordar → sono → deitar → alarme. Aponta a caneta para cada marca no momento em que fala o horário.",
      },
    ],
    extras: [
      {
        inicio: "00:00",
        fim: "00:05",
        tipo: "texto",
        titulo: "Headline do gancho",
        linhas: [{ txt: "5 maneiras de conseguir\ndormir mais cedo", papel: "destaque" }],
        fala: "Dormir às 23 horas, hahah, sonho. Eu vou te passar 5 maneiras de tu conseguir dormir no horário que tu quer.",
        instrucao: "Entra logo depois do print do comentário; headline branca sobre faixa preta.",
        nota: "A abertura usa o print de um comentário de seguidor (imagem importada).",
      },
      {
        inicio: "00:43",
        fim: "01:11",
        tipo: "lista",
        titulo: "Lista priorizada, riscando as de baixo",
        linhas: [
          { txt: "Lista de atividades", papel: "titulo" },
          { txt: "as mais importantes em cima", papel: "item" },
          { txt: "as de baixo, tu risca", papel: "item" },
        ],
        fala: "Cria uma lista de tudo, coloca em ordem de prioridade e começa a riscar as de baixo, aquelas que se tu deixar de fazer nada desmorona.",
        instrucao: "Os cartões entram desordenados, se alinham em coluna única e então ele risca os últimos com a caneta.",
      },
      APP_CTA,
    ],
  },
  {
    reel: "Dcha64XS1VQ",
    title: "As 3 prioridades do dia entrando na agenda",
    summary:
      "No vídeo sobre gestão de tempo para TDAH, a tela mostra três caixas roxas “Prioridade 1, 2 e 3” que depois voam para dentro da grade de um dia recortado (5h às 18h). É a cena da regra das três prioridades.",
    link_confidence: "alta",
    link_reason:
      "A cena do projeto tem exatamente os três blocos de texto “Prioridade 1/2/3” marcados para ir para a agenda, num recorte de um dia das 5h às 18h — o mesmo que o frame a frame descreve em [01:37] e [01:45].",
    padrao: [4],
    anotacoes: [
      {
        inicio: "01:37",
        fim: "01:52",
        titulo: "Três prioridades, e só três",
        fala: "Começa definindo três prioridades no teu dia das quais tu vai te comprometer a executar. Talvez três pareça pouco, mas domina essas três primeiro.",
        instrucao: "Mostra três dedos ao falar em três. As caixas roxas entram e depois encaixam nos horários do dia.",
      },
    ],
    extras: [
      {
        inicio: "00:02",
        fim: "00:08",
        tipo: "texto",
        titulo: "Headline do gancho",
        linhas: [{ txt: "Gestão de tempo para TDAH", papel: "destaque" }],
        fala: "Mas funciona pra TDAH e autista? O TDAH tem uma alteração no fluxo de dopamina no cérebro.",
        instrucao: "Entra depois do print da pergunta e some quando a explicação científica começa.",
        nota: "A abertura e a parte científica usam print do comentário e recortes de artigos (imagens importadas).",
      },
      {
        inicio: "01:16",
        fim: "01:37",
        tipo: "agenda",
        titulo: "Agenda da semana como prova",
        agenda: {
          recorte: "semana",
          titulo: "Agenda da semana",
          blocos: [
            { dia: 0, inicio: "07:00", dur: 60, cat: "f3", rot: "Café da manhã" },
            { dia: 0, inicio: "08:00", dur: 60, cat: "f1", rot: "Prioridades" },
            { dia: 0, inicio: "12:00", dur: 60, cat: "f3", rot: "Almoço" },
            { dia: 0, inicio: "19:00", dur: 60, cat: "f3", rot: "Treino" },
            { dia: 1, inicio: "10:00", dur: 60, cat: "f2", rot: "Reunião" },
          ],
        },
        fala: "Eu já tive muitos alunos com TDAH que, depois que implementaram um sistema de organização, relataram que a vida ficou muito mais fácil.",
        instrucao: "A agenda entra inteira como prova visual enquanto ele fala de implementação gradativa.",
      },
      APP_CTA,
    ],
  },
  {
    reel: "Dc2FoG-yce7",
    title: "Batching: atividades curtas agrupadas no início do dia",
    summary:
      "Um dia recortado mostra primeiro as atividades curtas espalhadas e depois agrupadas em bloco, com reunião e tempo coringa. A tela sustenta o conceito de batching enquanto ele fala.",
    link_confidence: "alta",
    link_reason:
      "A cena do projeto é um dia recortado (5h às 20h) com blocos “Atividade Curta”, “Reunião de equipe” e “Tempo coringa” — os mesmos rótulos que o frame a frame lê na tela em [00:24] (“Atividade Curta / Atividade Curta / Atividade Curta / Atividade Longa”).",
    padrao: [5],
    anotacoes: [
      {
        inicio: "00:13",
        fim: "00:59",
        titulo: "Espalhadas x agrupadas",
        fala: "Se a gente faz várias atividades pequenas espalhadas, são mais vezes que a gente se distrai. Agrupa elas pra fazer uma depois da outra, logo no início do dia.",
        instrucao: "Primeiro marca com a caneta as atividades espalhadas; depois desenha a chave agrupando o bloco da manhã. Gestos de check no ar ao falar dos vários checks.",
      },
    ],
    extras: [
      {
        inicio: "00:00",
        fim: "00:05",
        tipo: "texto",
        titulo: "Headline do gancho",
        linhas: [{ txt: "Batching", papel: "destaque" }, { txt: "Agrupar tarefas para executá-las de uma vez só", papel: "apoio" }],
        fala: "Pra sobrar mais tempo no dia e tu te distrair menos, tem um conceito de gestão de tempo que vai te ajudar.",
        instrucao: "Headline em cima da agenda; some aos 5 segundos, quando ele faz a pergunta.",
      },
      {
        inicio: "00:29",
        fim: "00:38",
        tipo: "imagem",
        titulo: "Capa do livro Eat That Frog",
        fala: "Tem um livro chamado Eat That Frog que diz que a gente tem que começar o dia com a atividade mais difícil.",
        instrucao: "A capa entra no lugar da agenda e sai quando ele volta ao método dele.",
        nota: "Imagem importada (capa do livro), não é uma cena montada no estúdio.",
      },
      APP_CTA,
    ],
  },
  {
    reel: "DchmS61SUMU",
    title: "Agenda flexível para quem é bom em improvisar",
    summary:
      "Contraste em três tempos: a agenda hiperlotada e rígida como anti-exemplo, a grade limpa só com os balizadores verdes (dormir, alimentar, treinar) e, no fim, o dia com blocos grandes agrupados mais o coringa. No meio entra a lista de atividades numerada, que é ordenada por prioridade.",
    link_confidence: "media",
    link_reason:
      "A cena de lista do projeto (agenda com a lista de atividades ligada ao lado, cartões coloridos numerados) é a mesma tela que o frame a frame descreve em [01:51]-[02:00] (“Lista de atividades”, itens numerados de 1 a 15 se alinhando). As telas de agenda saturada e do dia agrupado não ficaram salvas no projeto: foram reconstruídas do frame a frame.",
    padrao: [2],
    anotacoes: [
      {
        inicio: "01:51",
        fim: "02:05",
        titulo: "Lista de atividades → ordem de prioridade",
        fala: "Tira tudo da tua cabeça e cria uma lista de atividades. Depois coloca ela em ordem de prioridade; vai de cima pra baixo.",
        instrucao: "Os cartões entram desordenados e se alinham em coluna. Desenha a seta vertical apontando para baixo.",
      },
    ],
    extras: [
      {
        inicio: "00:00",
        fim: "00:08",
        tipo: "texto",
        titulo: "Headline do gancho",
        linhas: [{ txt: "Organização pessoal para empreendedores\nque são bons em improvisar", papel: "destaque" }],
        fala: "Empreendedor que é muito bom em se virar com o imprevisto normalmente tem dificuldade em se organizar.",
        instrucao: "Headline sobre a agenda vazia; some aos 8 segundos.",
      },
      {
        inicio: "00:33",
        fim: "01:11",
        tipo: "agenda",
        titulo: "Anti-exemplo: a agenda rígida e lotada",
        agenda: {
          recorte: "semana",
          titulo: "Agenda da semana",
          blocos: [
            { dia: 0, inicio: "09:00", dur: 60, cat: "vaz", rot: "Atividade 1" },
            { dia: 0, inicio: "10:00", dur: 60, cat: "vaz", rot: "Atividade 2" },
            { dia: 0, inicio: "11:00", dur: 60, cat: "vaz", rot: "Atividade 3" },
            { dia: 0, inicio: "13:00", dur: 60, cat: "f2", rot: "Reunião" },
            { dia: 1, inicio: "09:00", dur: 60, cat: "vaz", rot: "Atividade 4" },
            { dia: 1, inicio: "10:00", dur: 60, cat: "f2", rot: "Reunião" },
            { dia: 1, inicio: "11:00", dur: 60, cat: "vaz", rot: "Atividade 5" },
          ],
        },
        fala: "Uma agenda rígida assim, com tudo bem preenchido, funciona pro cara que é muito analítico e metódico.",
        instrucao: "Mostra a grade picotada de hora em hora como anti-exemplo. Tom crítico, gesticula com a caneta.",
      },
      {
        inicio: "01:12",
        fim: "01:50",
        tipo: "agenda",
        titulo: "Só os balizadores",
        agenda: {
          recorte: "semana",
          titulo: "Agenda da semana",
          blocos: [
            { dia: 0, inicio: "05:00", dur: 120, cat: "sono", rot: "Dormir" },
            { dia: 0, inicio: "12:00", dur: 60, cat: "f3", rot: "Almoço" },
            { dia: 0, inicio: "19:00", dur: 60, cat: "f3", rot: "Treino" },
            { dia: 0, inicio: "23:00", dur: 60, cat: "sono", rot: "Dormir" },
            { dia: 1, inicio: "12:00", dur: 60, cat: "f3", rot: "Almoço" },
            { dia: 1, inicio: "19:00", dur: 60, cat: "f3", rot: "Treino" },
          ],
          etapas: [{ nome: "Dormir", cats: ["sono"] }, { nome: "Refeições e treinos", cats: ["f3"] }],
        },
        fala: "Faz o teu melhor pra ter regularidade no horário de acordar, alimentar, atividade física e dormir. São balizadores pro resto da rotina.",
        instrucao: "A grade fica limpa, só com os blocos verdes e o sono. Desenha círculos em volta de cada bloco enquanto enumera.",
      },
      {
        inicio: "02:05",
        fim: "02:40",
        tipo: "agenda",
        titulo: "Dia com blocos agrupados + coringa",
        agenda: {
          recorte: "dia",
          dia: 1,
          h0: 5,
          h1: 20,
          titulo: "Agenda do dia",
          blocos: [
            { dia: 1, inicio: "09:00", dur: 180, cat: "f1", rot: "Atividades 1, 2 e 3" },
            { dia: 1, inicio: "12:00", dur: 60, cat: "f3", rot: "Almoço" },
            { dia: 1, inicio: "14:00", dur: 120, cat: "f2", rot: "Reuniões" },
            { dia: 1, inicio: "16:00", dur: 60, cat: "desvio", rot: "Coringa" },
          ],
        },
        fala: "Ao invés de das nove às dez isso e das dez às onze aquilo, agrupa: atividades um, dois e três das nove ao meio-dia. E não esquece do tempo coringa.",
        instrucao: "Desenha a seta branca apontando para o bloco amarelo do coringa quando falar dele.",
      },
    ],
  },
  {
    reel: "DckHHceSAHF",
    title: "Três níveis de clareza: lista → prioridade → semana",
    summary:
      "Reconstruído do frame a frame: os cartões de tarefa entram soltos, ganham check, se alinham em coluna por prioridade com uma seta descendente e por fim se distribuem na agenda da semana. Uma tela por nível do raciocínio.",
    link_confidence: "alta",
    link_reason:
      "Reconstrução direta do frame a frame do vídeo (cartões de tarefa → coluna ordenada com seta → grade semanal preenchida). Este fluxo não ficou salvo no projeto do estúdio.",
    cenas: [
      {
        inicio: "00:00",
        fim: "00:12",
        tipo: "texto",
        titulo: "Gancho: a dor do dia ocupado",
        linhas: [{ txt: "Passa o dia ocupado\nmas acha que não fez nada", papel: "destaque" }],
        fala: "Se tu passa o dia inteiro ocupado, mas chega de noite com aquela sensação de que não fez nada, seus problemas acabaram.",
        instrucao: "Texto no centro da tela de baixo, fica até ele terminar o diagnóstico da falta de clareza.",
      },
      {
        inicio: "00:13",
        fim: "00:27",
        tipo: "lista",
        titulo: "Nível 1: a to-do list com checks",
        linhas: [
          { txt: "Lista de atividades", papel: "titulo" },
          { txt: "Treino", papel: "item" },
          { txt: "Reunião de equipe", papel: "item" },
          { txt: "Proposta de cliente", papel: "item" },
          { txt: "E-mails", papel: "item" },
        ],
        fala: "A primeira forma de resolver isso é fazer uma lista de todas as atividades. E daí tu vai riscando as que fez, dá um check.",
        instrucao: "Os cartões entram um a um enquanto ele fala; os checks aparecem depois, no ritmo em que ele gesticula o check no ar.",
      },
      {
        inicio: "00:28",
        fim: "00:51",
        tipo: "lista",
        titulo: "Nível 2: ordem de prioridade",
        linhas: [
          { txt: "Lista de atividades", papel: "titulo" },
          { txt: "1. o que mais gera progresso", papel: "item" },
          { txt: "2. ...", papel: "item" },
          { txt: "3. ...", papel: "item" },
        ],
        fala: "Um segundo nível é colocar essas atividades em ordem de prioridade, pra começar o dia pela mais importante.",
        instrucao: "Os cartões se reorganizam em coluna única; desenha a seta descendente ao lado e acompanha com a mão.",
      },
      {
        inicio: "00:52",
        fim: "01:11",
        tipo: "agenda",
        titulo: "Nível 3: planejar a semana em torno delas",
        agenda: {
          recorte: "semana",
          titulo: "Agenda da semana",
          blocos: [
            { dia: 0, inicio: "07:00", dur: 60, cat: "f3", rot: "Café da manhã" },
            { dia: 0, inicio: "08:00", dur: 120, cat: "f1", rot: "Prioridades" },
            { dia: 0, inicio: "12:00", dur: 60, cat: "f3", rot: "Almoço" },
            { dia: 0, inicio: "14:00", dur: 60, cat: "vaz", rot: "Atividade" },
            { dia: 1, inicio: "08:00", dur: 60, cat: "f1", rot: "Prioridades" },
            { dia: 1, inicio: "10:00", dur: 60, cat: "f2", rot: "Reunião" },
            { dia: 1, inicio: "14:00", dur: 120, cat: "vaz", rot: "Atividade" },
          ],
          etapas: [
            { nome: "Prioridades", cats: ["f1"] },
            { nome: "Atividade", cats: ["vaz"] },
          ],
        },
        fala: "E o terceiro nível é planejar a tua semana em torno dessas atividades: o que não terminou na segunda já tem dia e hora pra acontecer.",
        instrucao: "Os blocos entram nos horários enquanto ele fala. Aponta a caneta para os outros dias ao falar do que ficou pra depois.",
      },
      APP_CTA,
    ],
  },
  {
    reel: "Dc_S10IBAOa",
    title: "O tempo que é teu e o tempo que é dos outros (rotina imprevisível)",
    summary:
      "Reconstruído do frame a frame: a agenda de um dia é dividida em duas faixas — o horário em que ele tem que estar disponível para os clientes/pacientes e o horário que é dele. Depois a lista de atividades é separada em prioritárias e “faço quando der”, e cada grupo vai para a faixa certa.",
    link_confidence: "alta",
    link_reason:
      "Reconstrução do frame a frame (faixa laranja 08:00–19:00 “Horário dos pacientes”, blocos “Horário meu”, colunas “Atividades Prioritárias” e “Atividades FQD”). Não há cena correspondente no projeto salvo.",
    cenas: [
      {
        inicio: "00:00",
        fim: "00:04",
        tipo: "texto",
        titulo: "Headline do gancho",
        linhas: [{ txt: "Como se organizar quando a dinâmica\ndo teu trabalho é imprevisível", papel: "destaque" }],
        fala: "Uma vida organizada é uma vida mais fácil. Mas como se organizar quando a dinâmica do teu trabalho não é previsível?",
        instrucao: "Headline sobre a agenda do dia ao fundo; some quando ele começa a ler o comentário.",
      },
      {
        inicio: "00:05",
        fim: "00:18",
        tipo: "imagem",
        titulo: "Print do comentário do seguidor",
        fala: "Sou médico veterinário e quase todos os atendimentos são emergência, marcados no mesmo dia.",
        instrucao: "Olha para baixo enquanto lê o print; volta o olhar para a câmera no fim.",
        nota: "Print de comentário importado — não é uma cena montada no estúdio.",
      },
      {
        inicio: "00:28",
        fim: "00:43",
        tipo: "agenda",
        titulo: "A faixa que não é tua",
        agenda: {
          recorte: "dia",
          dia: 1,
          h0: 5,
          h1: 24,
          titulo: "Agenda do dia",
          blocos: [{ dia: 1, inicio: "08:00", dur: 660, cat: "f2", rot: "Horário dos pacientes" }],
        },
        fala: "Vamos supor que tu trabalha das 8 da manhã às 7 da noite. Essa é uma janela de tempo que não é tua, é dos teus pacientes.",
        instrucao: "Desenha a chave ao lado da faixa laranja enquanto fala. Ênfase no “não é tua”.",
      },
      {
        inicio: "00:44",
        fim: "00:52",
        tipo: "agenda",
        titulo: "O tempo que é teu",
        agenda: {
          recorte: "dia",
          dia: 1,
          h0: 5,
          h1: 24,
          titulo: "Agenda do dia",
          blocos: [
            { dia: 1, inicio: "05:00", dur: 120, cat: "sono", rot: "Dormir" },
            { dia: 1, inicio: "07:00", dur: 60, cat: "f1", rot: "Horário meu" },
            { dia: 1, inicio: "08:00", dur: 660, cat: "f2", rot: "Horário dos pacientes" },
            { dia: 1, inicio: "19:00", dur: 240, cat: "f1", rot: "Horário meu" },
            { dia: 1, inicio: "23:00", dur: 60, cat: "sono", rot: "Dormir" },
          ],
          etapas: [
            { nome: "Dormir", cats: ["sono"] },
            { nome: "Horário dos pacientes", cats: ["f2"] },
            { nome: "Horário meu", cats: ["f1"] },
          ],
        },
        fala: "Assumindo que tu dorme das 11 da noite às 7 da manhã, esses horários que sobraram, esse é um tempo teu.",
        instrucao: "Desenha as chaves nos intervalos da manhã e da noite. Gesto de contraste com as duas mãos no fechamento.",
      },
      {
        inicio: "00:53",
        fim: "01:13",
        tipo: "lista",
        titulo: "Brain dump e o filtro de prioridade",
        linhas: [
          { txt: "Atividades prioritárias", papel: "titulo" },
          { txt: "Atividades FQD (faço quando der)", papel: "titulo" },
        ],
        fala: "Pega tudo que está no teu cérebro e coloca no papel. Depois separa o que é prioridade do restante.",
        instrucao: "As caixas entram soltas e se separam em duas colunas. Toca a têmpora ao falar em brain dump.",
      },
      {
        inicio: "01:14",
        fim: "01:43",
        tipo: "agenda",
        titulo: "Cada grupo na faixa certa",
        agenda: {
          recorte: "dia",
          dia: 1,
          h0: 5,
          h1: 24,
          titulo: "Agenda do dia",
          blocos: [
            { dia: 1, inicio: "07:00", dur: 60, cat: "f1", rot: "Prioridade 1" },
            { dia: 1, inicio: "08:00", dur: 660, cat: "f2", rot: "Horário dos pacientes" },
            { dia: 1, inicio: "10:00", dur: 60, cat: "vaz", rot: "Atividade FQD" },
            { dia: 1, inicio: "14:00", dur: 60, cat: "vaz", rot: "Atividade FQD" },
            { dia: 1, inicio: "19:00", dur: 120, cat: "f1", rot: "Prioridade 2" },
          ],
        },
        fala: "O que é prioridade vai nos horários que tu tem controle. O que não for tão prioridade tu coloca ao longo do horário que é dos pacientes.",
        instrucao: "Desenha setas ligando a lista à agenda; primeiro as prioridades, depois as FQD dentro da faixa laranja.",
      },
      APP_CTA,
    ],
  },
  {
    reel: "Dc3hmmQhbpp",
    title: "Home office: uma agenda só, com hora de começar e de terminar",
    summary:
      "Reconstruído do frame a frame: a semana inteira (pessoal e profissional na MESMA agenda) sustenta o argumento da clareza; depois um dia recortado mostra os limites de início e fim do trabalho, marcados com a caneta.",
    link_confidence: "media",
    link_reason:
      "Reconstrução do frame a frame (“Agenda da Semana” no rodapé, comparação de duas agendas, “Agenda do Dia” com sono, vida pessoal e trabalho). Parte das telas do vídeo são ilustrações importadas, não cenas do estúdio.",
    cenas: [
      {
        inicio: "00:00",
        fim: "00:15",
        tipo: "imagem",
        titulo: "Print da pergunta do seguidor",
        fala: "Como conciliar agenda pessoal com agenda de tarefas do trabalho? Home office. Unifica tudo?",
        instrucao: "Lê a pergunta olhando para o print; o print some quando ele se apresenta.",
        nota: "Print de comentário importado.",
      },
      {
        inicio: "00:16",
        fim: "00:35",
        tipo: "agenda",
        titulo: "Uma agenda só: as 24h e os 7 dias",
        agenda: {
          recorte: "semana",
          titulo: "Agenda da semana",
          blocos: [
            { dia: 0, inicio: "05:00", dur: 120, cat: "sono", rot: "Dormir" },
            { dia: 0, inicio: "09:00", dur: 180, cat: "f1", rot: "Trabalho" },
            { dia: 0, inicio: "12:00", dur: 60, cat: "f3", rot: "Almoço" },
            { dia: 0, inicio: "19:00", dur: 60, cat: "f3", rot: "Treino" },
            { dia: 0, inicio: "20:00", dur: 120, cat: "vaz", rot: "Vida pessoal" },
            { dia: 0, inicio: "23:00", dur: 60, cat: "sono", rot: "Dormir" },
          ],
        },
        fala: "A agenda é a representação visual de como tu gostaria que as tuas 24 horas e os sete dias da semana acontecessem. Se separa os dois, dificulta.",
        instrucao: "Mostra a semana inteira com pessoal e profissional juntos. Ênfase em “clareza é o nome do jogo”.",
      },
      {
        inicio: "00:36",
        fim: "00:59",
        tipo: "imagem",
        titulo: "As distrações de casa",
        fala: "A geladeira, a TV, o sofá, o cachorro... está tudo muito perto de ti.",
        instrucao: "A ilustração entra pela direita; ele lista as distrações em ritmo acelerado e bem-humorado.",
        nota: "Ilustração importada (home office), não é cena do estúdio.",
      },
      {
        inicio: "01:00",
        fim: "01:47",
        tipo: "agenda",
        titulo: "Hora de começar e hora de terminar",
        agenda: {
          recorte: "dia",
          dia: 1,
          h0: 5,
          h1: 24,
          titulo: "Agenda do dia",
          blocos: [
            { dia: 1, inicio: "05:00", dur: 120, cat: "sono", rot: "Dormir" },
            { dia: 1, inicio: "07:00", dur: 60, cat: "f3", rot: "Café da manhã" },
            { dia: 1, inicio: "09:00", dur: 180, cat: "f1", rot: "Trabalho" },
            { dia: 1, inicio: "12:00", dur: 60, cat: "f3", rot: "Almoço" },
            { dia: 1, inicio: "13:00", dur: 300, cat: "f1", rot: "Trabalho" },
            { dia: 1, inicio: "19:00", dur: 180, cat: "vaz", rot: "Vida pessoal" },
            { dia: 1, inicio: "23:00", dur: 60, cat: "sono", rot: "Dormir" },
          ],
        },
        fala: "O que funciona é simular que tu está no escritório: tem hora pra começar a trabalhar e hora pra terminar, e um espaço da casa que é só trabalho.",
        instrucao: "Marca com a caneta o início e o fim do bloco de trabalho, duas linhas horizontais. Tom de regra inegociável.",
      },
      APP_CTA,
    ],
  },
];

// ------------------------------------------------------------------- carga

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL não definida (.env.local).");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  const padrao = lerPadrao();

  try {
    const { rowCount } = await pool.query(`delete from studio_flows where kind = 'referencia' and link_source = 'seed'`);
    if (rowCount) console.log(`${rowCount} fluxos de referência antigos removidos (recarga).`);

    for (const f of FLUXOS) {
      const { rows } = await pool.query<{ id: string; caption: string | null }>(
        `select id, caption from videos where permalink ilike $1 limit 1`,
        [`%${f.reel}%`]
      );
      const video = rows[0];
      if (!video) console.warn(`! Vídeo do reel ${f.reel} não encontrado no banco — o fluxo entra sem ligação.`);

      // cenas do projeto salvo + anotações de fala/tempo, depois as extras
      const doProjeto = (f.padrao ?? []).map((n, k) => {
        const cenaPadrao = padrao[n - 1];
        if (!cenaPadrao) throw new Error(`Cena ${n} não existe no projeto embutido.`);
        const cena = padraoParaCena(cenaPadrao);
        const a = f.anotacoes?.[k];
        return a ? { ...cena, inicio: a.inicio, fim: a.fim, titulo: a.titulo, fala: a.fala, instrucao: a.instrucao, nota: a.nota } : cena;
      });

      const cenas: StudioScene[] = f.cenas ?? [...doProjeto, ...(f.extras ?? [])];
      cenas.sort((a, b) => (a.inicio ?? "99").localeCompare(b.inicio ?? "99"));

      // o projeto que abre no estúdio: as cenas ORIGINAIS dele quando existem;
      // nos fluxos reconstruídos, o projeto é montado a partir das cenas
      const project: unknown = f.padrao?.length
        ? { c: f.padrao.map((n) => padrao[n - 1]), t: f.padrao.map(() => []) }
        : toStudioProject(cenas);

      await pool.query(
        `insert into studio_flows (video_id, kind, title, summary, scenes, project, link_source, link_confidence, link_reason, status, created_by)
         values ($1, 'referencia', $2, $3, $4, $5, 'seed', $6, $7, 'done', 'analise-claude')`,
        [
          video?.id ?? null,
          f.title,
          f.summary,
          JSON.stringify(cenas),
          project ? JSON.stringify(project) : null,
          f.link_confidence,
          f.link_reason,
        ]
      );
      console.log(
        `✓ ${f.title} → ${video ? (video.caption ?? "").split("\n")[0].slice(0, 45) : "sem vídeo"} (${cenas.length} cenas, ` +
          `${f.padrao?.length ?? 0} do projeto salvo)`
      );
    }

    const { rows } = await pool.query<{ kind: string; n: string }>(`select kind, count(*)::text n from studio_flows group by kind`);
    console.log("\nFluxos no banco:", rows.map((r) => `${r.kind}: ${r.n}`).join(" · "));
  } finally {
    await pool.end();
  }
}

main();
