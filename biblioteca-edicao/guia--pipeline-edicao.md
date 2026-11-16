---
slug: pipeline-edicao
kind: guia
title: Pipeline de edição (como montar um vídeo)
summary: Passo a passo técnico: transcrição, escolha de takes, sincronia com o iPad, extração e render.
tags: técnico, ffmpeg, remotion, whisper
---
1. **Transcrição por palavra** do bruto (faster-whisper large-v3 na GPU, `word_timestamps`). O Gemini sozinho erra os tempos em trechos longos.
2. **Roteiro final = último take completo de cada frase.** O bruto tem muitas repetições e falsos começos; pegue sempre a última versão inteira e sem erro. Ver [[usar-ultimo-take-completo]].
3. **Corte exato de cada take**: janela por frase → Gemini localiza a tomada → ajuste fino pelo `silencedetect` do ffmpeg. Conferir transcrevendo cada corte isolado.
4. **Pausas internas** > 0,3s viram jump cut (fica 0,12s de respiro). Fade de áudio de 10ms em cada emenda.
5. **Sincronia com o iPad** (formato [[metadinha]]): extrair o áudio das duas gravações a 8 kHz, envelope a 100 Hz, correlação cruzada em 3 janelas (início, meio, fim). Exemplo real: iPad = bruto − 0,89s, deriva de ~0,03s em 15 min.
6. **Recorte do iPad** (2752x2064): só o quadro do Estúdio Reels, `crop=1692:1504:528:504` → `scale=1080:960`. Conferir num frame, pois muda se a UI do iPad mudar.
7. **Augusto**: `mpdecimate` antes do `fps=30` (ver [[video-fluido-sem-travar]]), `scale=1080:1920`, grade leve (`eq=contrast=1.04:saturation=1.03`, unsharp suave), sem vinheta.
8. **Render** em Remotion 1080x1920 30fps, `--crf=16 --jpeg-quality=95`; se travar em algum frame, `--timeout=180000 --concurrency=4`.
9. **Conferência**: frames de cada etapa + contagem de frames repetidos no recorte do Augusto.
