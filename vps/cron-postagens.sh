#!/usr/bin/env bash
# De 5 em 5 minutos (/etc/cron.d/postador): publica as postagens agendadas que venceram
# e termina as que estão processando na Meta.
set -a; . /docker/postador/.env; set +a
curl -sS -m 290 -H "Authorization: Bearer $POSTAGEM_SECRET" "$APP_URL/api/postagens/cron" > /var/log/postador.last 2>&1 \
  || echo "$(date -Is) falhou: $(tail -c 300 /var/log/postador.last)" >> /var/log/postador.err
