# VPS do postador

A VPS (Hostinger KVM 1, `srv2157937.hstgr.cloud`) guarda os vídeos que vão para o
Instagram e roda o cron das postagens agendadas. Ela também hospeda outro projeto
(figurinhas/stickersdamana): nada daqui mexe nele.

| O quê | Onde na VPS |
|---|---|
| Serviço de upload (`upload.py`) | `/opt/studiotita/upload.py`, systemd `studiotita-upload` (127.0.0.1:3311) |
| Segredo compartilhado | `/etc/studiotita/postagem.env` (`POSTAGEM_SECRET`, o mesmo da Vercel) |
| Vídeos e capas | `/srv/studiotita/videos/`, servidos em `https://srv2157937.hstgr.cloud/v/` |
| nginx | `/etc/nginx/sites-available/studiotita-videos` (HTTPS pelo certbot) |
| Cron | `/etc/cron.d/studiotita-postagens`: de 5 em 5 min chama `/api/postagens/cron`; todo dia apaga arquivos com mais de 30 dias |

Na Vercel: `VPS_VIDEOS_URL=https://srv2157937.hstgr.cloud` e `POSTAGEM_SECRET`.

Para reinstalar, rode `vps/setup.sh` na VPS (como root) com o `POSTAGEM_SECRET` no ambiente.
