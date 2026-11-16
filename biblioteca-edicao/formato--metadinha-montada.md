---
slug: metadinha-montada
kind: formato
title: Metadinha montada em código
summary: Mesmo split-screen, mas a metade de baixo é recriada em HTML/Remotion (agenda, triângulo, cards) com riscos de caneta simulados.
tags: split-screen, remotion, motion
---
Usar só quando **não existe** a gravação da tela do iPad. A metade de baixo imita uma tela de app real (o Estúdio Reels) com o Augusto riscando por cima.

## Conceito
Tela de produto SaaS limpa, dark e sóbria + rabisco de caneta estilo Apple Pencil. Nada de neon, emoji, legenda karaokê ou zoom punch. A informação acompanha a fala.

## Layout
- Vídeo do Augusto em cima, painel embaixo. Divisão padrão 50/50 (960px); quando o gráfico precisa de espaço (triângulo), vídeo com ~740px.
- Conteúdo alinhado à esquerda (~90px), ocupando ~2/3 da largura; o terço direito fica para ilustrações, setas e "?".
- O vídeo **já começa com a metadinha na tela**.

## Cores
| Uso | Hex |
|---|---|
| Fundo do painel | `#262628` |
| Texto principal | `#F2F2F2` |
| Texto secundário | `#8A8A8E` |
| Verde (rotina/vida) | `#5EDB84` |
| Roxo (gestão da clínica) | `#7461F0` |
| Laranja (pacientes) | `#FF9248` |
| Amarelo (coringa) | `#F7D65A` |
| Vinho (procrastinação) | `#B5475A` |
| Cinza (deslocamento/celular) | `#BDBDBD` |
| Dourado (CTA/app) | `#D4A537` |
| Caneta | `#FFFFFF` |

## Tipografia
- UI: Inter. Título de tela ("Agenda do Dia") semibold 44px; subtítulo cinza 21px.
- Título de capítulo: serifa (Source Serif 4) 64px branca, centralizada, parada.
- Rótulos do diagrama: Inter 800 caixa-alta preta em pílula branca com relevo.
- Caneta: Caveat 50–60px branca.

## Componentes
1. **Agenda do Dia**: coluna única, régua de horas (07:00/12:00/19:00/23:00 grandes), blocos coloridos empilhados.
2. **Agenda da semana**: 7 colunas, SÁB/DOM com cabeçalho claro; dias que mudam trocam de cor.
3. **Triângulo**: Pacientes / Clínica / Vida pessoal com elipses de caneta em cada lado.
4. **Card de app** (CTA): modal escuro, barra de progresso dourada, botões outline dourados.
5. **Ilustrações em grafite** P&B com leve sépia, fundo preto fundido no painel (~340px).

Regras que valem aqui: [[figura-ja-formada]], [[riscos-de-caneta]], [[camera-suave]], [[visual-3d-leve]], [[respiro-embaixo]], [[margem-e-texto-sem-sobreposicao]].
