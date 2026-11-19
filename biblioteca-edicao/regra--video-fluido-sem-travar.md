---
slug: video-fluido-sem-travar
kind: regra
title: Vídeo do Augusto fluido, sem travamentos
summary: None
tags: qualidade, ffmpeg
---
**Regra:** Não mexer nos quadros do vídeo do Augusto. Nada de `mpdecimate` (descartar quadros), nada de interpolar ou misturar quadros e nada de zoom contínuo ou reescala a cada quadro: tudo isso deixa a cadência irregular e causa leves travamentos. Usar os quadros do bruto como vieram, com um enquadramento fixo (escala e posição constantes durante a fala) e render final a 50 fps.

**Por quê:** O Augusto notou leves travamentos no desempenho do vídeo. As tentativas anteriores (`mpdecimate` antes do fps e zoom contínuo de +2,5%) são suspeitas e foram retiradas.

**Vale para:** todos os formatos
