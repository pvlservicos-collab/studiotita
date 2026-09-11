/**
 * Análise do Estúdio Reels (public/estudio-reels.html): a ferramenta em que o
 * Augusto monta as telas que aparecem nos vídeos dele. Vai no pedido ao
 * Gemini quando o toggle "Gerar cenas" está ligado, para as ideias de cena
 * usarem o que o estúdio sabe fazer. Se existir na Biblioteca um arquivo
 * "estudio-reels-cenas.md", ele substitui este texto (dá para editar lá).
 */

export const ESTUDIO_REELS_FILE = "estudio-reels-cenas.md";

export const ESTUDIO_REELS_GUIDE = `# ESTÚDIO REELS: como o Augusto monta as cenas dos vídeos

O Augusto grava falando para a câmera e, junto dele, entra uma tela escura (fundo quase preto, texto claro)
montada no Estúdio Reels. Cada cena é uma tela que acompanha um trecho da fala, e cada cena tem uma
instrução de fala para ele (ritmo, pausa, onde apontar).

## Tipos de cena que o estúdio faz
1. NÚMERO/TEXTO GRANDE: frase curta de 1 a 4 linhas com um número gigante em destaque.
   Ex.: "Uma semana possui / 168 horas"; "Sobreviver custa / 56h / um terço da sua semana";
   "112h acordado / 56h dormindo". Frase de efeito em itálico cinza embaixo ("Não é filosofia. É subtração.").
2. PERGUNTA DIRETA centralizada, em negrito ("Onde foram as suas 112 horas?"), seguida de pausa longa.
3. LISTA RÁPIDA: título + 3 a 5 itens curtos, um por linha, alternando cores
   (ex.: "O que ninguém orça: Deslocamento / E-mail e mensagem / Fila, banco, farmácia / O imprevisto que aparece").
   Uma pausa curta por item para a pessoa se reconhecer. Os itens podem entrar um a um, em ordem.
4. PENTÁGONO DA SEMANA: as 168 horas divididas em 5 áreas (Trabalho, Saúde, Lazer, Família, Aleatórias).
   Ele puxa um slider (ex.: sobe o Trabalho) e as outras áreas cedem: "enquanto você está em uma, não está nas outras".
5. AGENDA DA SEMANA (seg a dom, 5h às 24h), pintada com as categorias do método:
   Prioridades (roxo), Reunião (laranja), Prazo (vermelho claro), Treino e refeições (verde),
   Coringa (amarelo), Atividade (lilás), Celular (cinza), Dormir (cinza escuro).
   Modelos prontos: Semana do empresário (trabalho longo, treino à noite, fim de semana vazio),
   Semana lotada (a crença de que agenda boa é agenda cheia), Semana caótica (reunião em cima de reunião),
   Semana flexível (blocos que agrupam, com respiro e coringa), Semana equilibrada (blocos longos, espaço entre eles),
   Só o trabalho (o que sobra quando tudo é trabalho), Balizadores (só sono, almoço e treino), Só o sono.
   A agenda pode ser revelada em etapas (primeiro o sono, depois reuniões, coringa, refeições e treinos,
   prioridades, atividades), recortar só uma faixa de horas (ex.: a manhã, das 5 às 13) e agrupar blocos no meio da fala.
6. SONO: widget de horário de dormir e acordar e horas de sono, revelado em etapas.
7. MAPA MENTAL: um nó central com títulos, tópicos, notas, caixas e balões que surgem em etapas.
8. GRÁFICO ANIMADO (a linha se desenha da esquerda para a direita):
   - barras de progresso comparando duas coisas (ex.: por treino, musculação 100% vs jiu-jitsu 60%);
   - curvas de resultado ao longo dos meses: rotina ideal "robô" (referência tracejada), a tentativa que
     arranca e desiste (vermelho) e a constante (verde);
   - rotina que não gosta (resultado em 12 meses) vs rotina que gosta (24 meses, mas se mantém).
9. METAS: 3 cards (Financeiro, Saúde, Relacionamentos) com meta quantificável + data
   (ex.: "R$ 50 mil de faturamento por mês, até dez de 2026"), e o plano de ação surgindo embaixo de cada card.
10. ILUSTRAÇÃO PELA DIREITA: imagem importada à direita, texto à esquerda, e anotações escritas por cima com caneta.
11. CHAMADA FINAL: "Quer a agenda que eu uso? / Comenta 247" (ele fala o 247 duas vezes).

## Linguagem visual
- Cores de destaque: verde (saúde, positivo, o que funciona), laranja (trabalho, alerta), roxo (prioridades),
  amarelo (coringa), vermelho (erro, o que dá errado), cinza (texto secundário).
- Poucas palavras por tela; um número forte por cena; o texto fica na zona segura, sem cobrir o rosto dele.
- Pausas fazem parte da cena: "fala devagar", "deixa 2 segundos", "deixa o silêncio trabalhar", "pausa longa antes de virar".
- Revelação em etapas é o recurso principal de retenção: a tela vai se completando junto com a fala.`;

export const SCENES_INSTRUCTION = `Preencha também o campo "cenas": uma ideia de cena do Estúdio Reels para cada trecho do roteiro, usando só
o que o estúdio faz (descrito acima). Uma cena por linha, no formato:
"[0s–3s] TIPO DE CENA — o que aparece na tela (texto exato, número em destaque, cores, modelo de agenda ou
gráfico, e em que etapa cada coisa surge) — instrução de fala para o Augusto (ritmo, pausa, onde apontar)".`;
