#!/usr/bin/env bash
# Instala o postador na VPS (idempotente). Uso, como root:
#   POSTAGEM_SECRET=... bash setup.sh
# Espera /tmp/studiotita-upload.py (copiado antes). Não mexe nos outros sites do nginx.
set -euo pipefail
: "${POSTAGEM_SECRET:?defina POSTAGEM_SECRET}"
HOST=srv2157937.hstgr.cloud
APP=https://studiotita.vercel.app

mkdir -p /opt/studiotita /etc/studiotita /srv/studiotita/videos
install -m 755 /tmp/studiotita-upload.py /opt/studiotita/upload.py
chown -R www-data:www-data /srv/studiotita/videos

umask 077
cat > /etc/studiotita/postagem.env <<EOF
POSTAGEM_SECRET=$POSTAGEM_SECRET
VIDEOS_DIR=/srv/studiotita/videos
PUBLIC_BASE=https://$HOST
ALLOWED_ORIGINS=$APP,http://localhost:3000
EOF
umask 022

cat > /etc/systemd/system/studiotita-upload.service <<'EOF'
[Unit]
Description=Studio Tita - upload de videos do postador
After=network.target

[Service]
EnvironmentFile=/etc/studiotita/postagem.env
ExecStart=/usr/bin/python3 /opt/studiotita/upload.py
User=www-data
Group=www-data
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/srv/studiotita/videos
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now studiotita-upload
systemctl restart studiotita-upload

# nginx: só cria o site novo se ainda não existir (o certbot acrescenta o HTTPS depois)
if [ ! -f /etc/nginx/sites-available/studiotita-videos ]; then
cat > /etc/nginx/sites-available/studiotita-videos <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $HOST;

    location /v/ {
        alias /srv/studiotita/videos/;
        types { video/mp4 mp4; image/jpeg jpg; }
        add_header Access-Control-Allow-Origin "*";
        add_header Cache-Control "public, max-age=300";
    }
    location ~ ^/(upload|fetch)/ {
        client_max_body_size 1100m;
        proxy_request_buffering off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_pass http://127.0.0.1:3311;
        proxy_set_header Host \$host;
    }
    location / { return 404; }
}
EOF
ln -sf /etc/nginx/sites-available/studiotita-videos /etc/nginx/sites-enabled/studiotita-videos
fi
nginx -t
systemctl reload nginx

# HTTPS (Let's Encrypt) — sem pergunta, reaproveitando a conta do certbot já registrada
if [ ! -d /etc/letsencrypt/live/$HOST ]; then
  certbot --nginx -d $HOST --non-interactive --agree-tos --redirect --register-unsafely-without-email
fi

# cron: postagens agendadas (5 em 5 min) e limpeza diária dos arquivos com mais de 30 dias
cat > /opt/studiotita/cron-postagens.sh <<EOF
#!/usr/bin/env bash
set -a; . /etc/studiotita/postagem.env; set +a
curl -sS -m 290 -H "Authorization: Bearer \$POSTAGEM_SECRET" $APP/api/postagens/cron > /var/log/studiotita-postagens.last 2>&1 \
  || echo "\$(date -Is) falhou: \$(tail -c 300 /var/log/studiotita-postagens.last)" >> /var/log/studiotita-postagens.err
EOF
chmod 700 /opt/studiotita/cron-postagens.sh
cat > /etc/cron.d/studiotita-postagens <<'EOF'
# Studio Tita: publica as postagens agendadas e termina as que estão processando na Meta
*/5 * * * * root /opt/studiotita/cron-postagens.sh
# apaga vídeos e capas com mais de 30 dias
17 4 * * * root find /srv/studiotita/videos -type f -mtime +30 -delete
EOF
chmod 644 /etc/cron.d/studiotita-postagens
echo "ok"
