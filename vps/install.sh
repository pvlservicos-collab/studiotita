#!/usr/bin/env bash
# Instala/atualiza o postador na VPS do Titã. Rode em /docker/postador, como root,
# com POSTAGEM_SECRET no ambiente na primeira vez (depois ele fica no .env).
set -euo pipefail
cd /docker/postador
if [ ! -f .env ]; then
  : "${POSTAGEM_SECRET:?defina POSTAGEM_SECRET na primeira instalação}"
  umask 077
  cat > .env <<ENV
HOST=srv2009990.hstgr.cloud
APP_URL=https://studiotita.vercel.app
POSTAGEM_SECRET=$POSTAGEM_SECRET
PUBLIC_BASE=https://srv2009990.hstgr.cloud
ALLOWED_ORIGINS=https://studiotita.vercel.app,http://localhost:3000
ENV
  umask 022
fi
mkdir -p videos && chown 65534:65534 videos && chmod 755 videos
chmod 644 upload.py nginx-files.conf docker-compose.yml
chmod 700 cron-postagens.sh
docker compose up -d
cat > /etc/cron.d/postador <<'CRON'
# Postador do Studio Titã: postagens agendadas (5 em 5 min) e limpeza dos arquivos com mais de 30 dias
*/5 * * * * root /docker/postador/cron-postagens.sh
17 4 * * * root find /docker/postador/videos -type f -mtime +30 -delete
CRON
chmod 644 /etc/cron.d/postador
docker compose ps
