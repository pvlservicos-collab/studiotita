/**
 * PADRÕES DAS METADINHAS DO AUGUSTO.
 *
 * Foi tirado de: (1) o projeto salvo dentro do Estúdio Reels (as cenas que
 * ele montou de verdade) e (2) o frame a frame das análises dos vídeos dele
 * em que a tela do estúdio aparece na metade de baixo. Cada fluxo de
 * referência ficou ligado ao vídeo em que foi usado (tabela studio_flows).
 *
 * É este texto que ensina o sistema a montar as metadinhas novas. Se existir
 * na Biblioteca um arquivo "estudio-reels-padroes.md", ele substitui este
 * texto — dá para editar lá sem mexer no código.
 */

export const ESTUDIO_PADROES_FILE = "estudio-reels-padroes.md";

export const ESTUDIO_PADROES = `# Como o Augusto monta as metadinhas (padrões observados)

Metadinha = o reel em que ele aparece no terço/metade de cima, com microfone de lapela na mão
(muitas vezes também a caneta digital), e a tela do Estúdio Reels ocupa a metade de baixo do quadro.
O palco do estúdio tem exatamente a proporção dessa metade (1080x960), então TUDO o que for montado
tem que caber ali, com poucas palavras e sem nada nas beiradas.

## 1. O desenho do vídeo
- A tela de baixo já entra montada junto com o primeiro segundo: ele nunca começa em tela cheia e
  depois "abre" o estúdio.
- Nos primeiros 3 a 13 segundos existe UM texto por cima da tela de baixo: a headline do gancho
  ("Os 7 níveis da organização pessoal", "Organização pessoal em menos de 3 minutos",
  "Gestão de tempo para TDAH", "Batching / Agrupar tarefas para executá-las de uma vez só").
  Esse texto some quando a explicação começa e não volta.
- Depois disso vale a regra: **uma cena por passo do raciocínio**. A tela muda a cada 10 a 40 segundos,
  sempre junto com a virada da fala. Tela parada por mais de 45 segundos só acontece quando ele está
  desenhando por cima com a caneta.
- O fim é sempre a conversão: a gravação de tela da plataforma (perguntas 1 de 7 "Sono", 2 de 7 "Trabalho"…,
  "Sua semana está montada", "A Minha Agenda em Ascensão") e o CTA falado "Digita/Comenta 247".
  Essa parte final NÃO é montada no estúdio: é gravação de tela do app.

## 2. A agenda é a protagonista
A cena de agenda aparece em quase toda metadinha, e quase sempre construída em camadas, na ordem
em que a semana é ocupada de verdade:
1. **Dormir** (sono, cinza escuro) — a base, 23h às 07h, todos os dias;
2. **Reunião / compromissos com outras pessoas** (f2, laranja) — "o que é mais difícil de mudar";
3. **Refeições e treino** (f3, verde) — café da manhã, almoço, jantar, treino: os balizadores;
4. **Coringa** (desvio, amarelo) — um no fim da manhã e um no fim da tarde;
5. **Prioridades** (f1, roxo) — entram primeiro no dia, não no que sobra;
6. **Atividade** (vaz, lilás) — o resto da lista;
7. **Espaços em branco** — ele circula com a caneta o que ficou vazio e explica por que tem que sobrar.
Quando o tema é prazo/entrega, entra também **Prazo** (vermelho claro).

Regras da agenda que ele repete:
- Semana inteira (seg a dom, 5h às 24h) quando fala de semana; **recorte de um dia** (aj.dia + faixa de
  horas, ex.: 5h às 18h) quando fala do dia.
- Os rótulos dos blocos são curtos e genéricos: "Dormir", "Café da manhã", "Almoço", "Jantar", "Treino",
  "Reunião", "Prioridades", "Atividade", "Coringa", "Trabalho focado" — ou o nome real quando é um exemplo
  ("Reunião com cliente", "Entrega: proposta", "Responder e-mails").
- Blocos grandes agrupados (9h ao meio-dia com "Atividades 1, 2 e 3") quando o assunto é flexibilidade;
  blocos picotados de 1h quando ele está mostrando o ERRO do metódico.
- A agenda lotada e colorida é usada como ANTI-exemplo antes de mostrar a versão limpa.

## 3. A escada de níveis (o recurso de retenção mais forte dele)
No vídeo dos 7 níveis, a MESMA agenda evolui do nível 0 ao 7, e o título em cima muda a cada nível
("Agenda da semana · Nível 3 · deadlines"). Cada nível acrescenta uma camada e mantém as anteriores.
Isso vale para qualquer conteúdo em degraus (níveis, etapas, fases): uma cena por degrau, mesmo quadro,
título mudando. O gancho desse vídeo foi a animação correndo os níveis em loop antes de explicar.

## 4. A caneta é o ponteiro
Ele desenha por cima da tela no momento exato em que nomeia a coisa: círculos nos blocos de sono e
treino, chaves ao lado de faixas de horário ("HORÁRIO DOS PACIENTES", "HORÁRIO MEU"), setas ligando a
lista à agenda, o número "112" escrito à mão na grade, riscos nas tarefas menos importantes.
Toda cena de agenda deve ter uma instrução de caneta ("circula os blocos verdes enquanto fala em balizadores").

## 5. As outras telas e quando cada uma entra
- **Lista de atividades**: título "Lista de atividades" e 12 a 15 cartões coloridos que entram
  desordenados, depois se alinham em coluna única com uma seta descendente (prioridade), depois entram
  na agenda (timeboxing). Serve para brain dump, priorização e batching.
- **Prioridade 1/2/3**: três caixas roxas grandes que depois voam para dentro da grade — é a cena da
  regra das 3 prioridades do dia.
- **A conta do sono**: acordar → 8h para trás → 15 min para pegar no sono → 1h antes, alarme
  "Preparar para dormir". Revelada em etapas, uma por frase.
- **Pentágono das 168 horas**: quando o assunto é troca ("enquanto você está em uma, não está nas outras").
- **Gráfico**: 1 = barras comparando dois caminhos; 2 = constância ao longo dos meses (o robô tracejado,
  o que arranca e desiste em vermelho, o constante em verde); 3 = rotina rápida x rotina lenta.
- **Mapa mental**: linha de pensamento, para vídeo de conceito.
- **Metas**: 3 cards (Financeiro, Saúde, Relacionamentos) com meta quantificável + data + plano.
- **Número/frase grande**: um número forte por cena ("168 horas", "56h", "112h"), frase de efeito em
  itálico cinza embaixo ("Não é filosofia. É subtração.").
- **Pergunta centralizada**: uma por vídeo, no máximo, seguida de pausa longa.

## 5b. Os modelos de semana prontos (use-os em vez de inventar a grade)
O estúdio tem grades prontas, e o Augusto trabalha em cima delas. Ao montar uma cena de agenda, escolha
um modelo pelo nome sempre que ele representar o que a fala descreve:
- **Balizadores** — só as âncoras (sono, almoço e treino nos dias úteis). Para falar de estrutura mínima.
- **Semana do empresário** — trabalho longo, treino à noite, fim de semana vazio. O retrato do público.
- **Semana lotada** — a crença de que agenda boa é agenda cheia, um bloco atrás do outro. ANTI-exemplo.
- **Semana caótica** — reunião em cima de reunião, sem respiro. ANTI-exemplo.
- **Semana mapeada (antes)** — 135 dias reais de alunos antes da mentoria, o dia picado em blocos de 12
  minutos, trabalho até de noite, treino quase zero. É a prova social do "antes".
- **Semana flexível** — blocos que agrupam (atividades 1, 2 e 3 das 9 ao meio-dia), com respiro e coringa.
- **Semana equilibrada** — blocos longos, espaço entre eles. O "depois".
- **Só o trabalho** — o que sobra quando tudo é trabalho. **Só o sono** — a base. **Vazia** — montar do zero.
O par ANTI-exemplo → versão certa (lotada/caótica/mapeada primeiro, equilibrada/flexível depois) é o
contraste visual mais forte que ele tem: a mesma grade, duas realidades.

## 5c. O pentágono das 168 horas
É a tela em que a semana inteira vira uma forma no meio da tela, com os números por área:
**Trabalho, Lazer, Aleatórias, Família e Saúde** (nessa ordem, no sentido horário). Ele puxa o slider de
uma área e as outras cedem — a soma é sempre 168 horas. Tem três ajustes prontos: equilíbrio (tudo
parecido), workaholic (trabalho em 80 e lazer/família no chão) e o "atual". A Saúde fica vermelha quando
cai abaixo do básico. Use o pentágono quando o assunto for TROCA e não organização: "enquanto você está
em uma, não está nas outras", escolha, sacrifício, o custo escondido de uma área comendo a outra. Em
geral ele entra logo depois de um número grande (168h, 112h, 56h) e antes da agenda.

## 6. Texto na tela
- No máximo 6 palavras por linha e 4 linhas por tela.
- Um número forte por cena, nunca dois.
- Cinza (#8E8A84) para o apoio, laranja (#E08C3A) para alerta/trabalho, verde (#73E294) para o que
  funciona, roxo para prioridade, vermelho para erro.
- Cartão de ressalva no centro quando ele precisa relativizar ("A vida real não é tão rígida/previsível
  assim, mas a ideia é manter a regularidade quando possível") — entra, fica 4 a 8 segundos e sai.

## 7. O que os números dizem
- As metadinhas que **constroem** algo na tela em camadas seguram muito mais: o vídeo das 112 horas
  (constrói a semana inteira do zero) fez 14,5 mil views com 647 salvamentos e 598 compartilhamentos;
  o dos 7 níveis, 9,6 mil views e 185 comentários (CTA 247).
- As metadinhas que só mostram uma tela pronta e falam por cima ficam na casa dos 2 mil views.
- O melhor desempenho da conta veio de um vídeo com a tela de baixo usada como apoio de uma LISTA de
  5 soluções (60 mil views, 2,5 mil salvamentos): a tela mudava a cada item, com ilustração,
  lista, conta do sono e o print do app.
- Print de comentário de seguidor como abertura aparece nos vídeos de resposta e funciona bem como gancho
  (o print não é feito no estúdio: é imagem importada).

## 8. Regras para montar um fluxo novo
1. Uma cena por parte da estrutura do vídeo; o tempo de cada cena sai do frame a frame/estrutura.
2. Só use o que o estúdio faz. Quando o vídeo pedir print, foto, meme, gravação de tela ou ilustração,
   marque isso na nota da cena, sem inventar que o estúdio monta.
3. Toda cena precisa de instrução de fala (ritmo, pausa, onde apontar, o que desenhar).
4. Se o vídeo fala de tempo, semana, rotina, prioridade ou imprevisto, quase sempre existe uma cena de
   agenda — e ela deve ser revelada em camadas, não pronta.
5. Fecha com a chamada final no padrão dele ("Comenta 247" / "Digita 247").`;
