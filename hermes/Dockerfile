# Hermes: Chrome de verdade (tela virtual) logado no ChatGPT + API que manda o
# comando num chat e devolve a imagem gerada. Ver hermes/README.md.
FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive TZ=America/Sao_Paulo LANG=pt_BR.UTF-8 LC_ALL=pt_BR.UTF-8 DISPLAY=:99

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates wget xvfb x11vnc fluxbox novnc websockify supervisor \
      fonts-liberation fonts-noto-color-emoji locales tzdata \
 && wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
 && apt-get install -y --no-install-recommends /tmp/chrome.deb \
 && rm /tmp/chrome.deb \
 && sed -i 's/^# *pt_BR.UTF-8/pt_BR.UTF-8/' /etc/locale.gen && locale-gen \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs start-chrome.sh supervisord.conf ./
RUN chmod +x start-chrome.sh && mkdir -p /data && chown -R node:node /data /app

EXPOSE 8080 6080
CMD ["supervisord", "-c", "/app/supervisord.conf"]
