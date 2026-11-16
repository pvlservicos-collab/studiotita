---
slug: video-fluido-sem-travar
kind: regra
title: Vídeo do Augusto fluido, sem engasgo
summary: None
tags: qualidade, ffmpeg
---
**Regra:** O bruto do iPhone vem a 60fps com cadência irregular (~30 quadros reais por segundo, duplicados de forma irregular). Converter direto com `fps=30` pega quadros repetidos e a imagem parece travar. Sempre aplicar `mpdecimate` antes do `fps=30` e conferir: zero quadros repetidos no recorte do Augusto.

**Por quê:** O Augusto reclamou que a imagem dele parecia "bugada, como se estivesse travando".

**Vale para:** todos os formatos
