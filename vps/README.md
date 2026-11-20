# Postador na VPS do Titã

O postador roda na VPS do Titã (Hostinger, Boston, `srv2009990.hstgr.cloud`, a mesma do
TitaCRM), em `/docker/postador`, como um projeto Docker separado. O Traefik que já existe
(`/docker/traefik`) faz o HTTPS. Nada daqui mexe no CRM nem na Evolution.

| O quê | Onde |
|---|---|
| Upload assinado (`upload.py`) | container `upload`, rotas `/upload/` e `/fetch/` |
| Vídeos e capas | `/docker/postador/videos/`, servidos pelo container `files` em `https://srv2009990.hstgr.cloud/v/` |
| Segredo compartilhado | `/docker/postador/.env` (`POSTAGEM_SECRET`, o mesmo da Vercel) |
| Cron | `/etc/cron.d/postador`: de 5 em 5 min chama `/api/postagens/cron`; todo dia apaga arquivos com mais de 30 dias |

O Traefik corta requisições com mais de 60 s, por isso a página manda o vídeo em partes
de 4 MB (`&parte=N&total=T`).

Na Vercel: `VPS_VIDEOS_URL=https://srv2009990.hstgr.cloud` e `POSTAGEM_SECRET`.

Atualizar: copie os arquivos desta pasta para `/docker/postador` e rode `bash install.sh`.
