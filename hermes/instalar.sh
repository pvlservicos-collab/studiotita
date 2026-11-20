#!/bin/bash
# Instala/atualiza o Hermes na VPS do Titã. Rodar em /docker/hermes como root.
# Na primeira vez gera .env (token da API + senha da tela). Depois só reconstrói.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  TOKEN=$(openssl rand -hex 32)
  SENHA=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)
  # Hash apr1 com $ dobrado: o compose interpola o .env.
  HASH=$(openssl passwd -apr1 "$SENHA" | sed 's/\$/$$/g')
  cat > .env <<EOF
DOMINIO=titacrm.ascensaotita.com
HERMES_TOKEN=$TOKEN
HERMES_PUBLIC_URL=https://titacrm.ascensaotita.com/hermes/api
HERMES_CHAT_URL=https://chatgpt.com/g/g-p-68361f1455908191811a9c4b5f7cc8ac-imagens-reels/c/6a90b8d3-0f2c-83e9-a3a4-3f0e064ef49f
TELA_HTPASSWD=hermes:$HASH
EOF
  chmod 600 .env
  printf 'hermes\n%s\n' "$SENHA" > tela-senha.txt
  chmod 600 tela-senha.txt
  echo "Gerado .env e tela-senha.txt (usuário/senha da tela)."
fi

mkdir -p data && chown -R 1000:1000 data
docker compose up -d --build
docker compose ps
