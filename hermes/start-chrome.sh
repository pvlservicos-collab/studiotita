#!/bin/sh
# Chrome normal (sem flags de automação): o Hermes só se conecta pela porta de
# depuração, que fica presa em 127.0.0.1 dentro do contêiner.
rm -f /data/profile/SingletonLock /data/profile/SingletonSocket /data/profile/SingletonCookie
exec google-chrome \
  --no-sandbox \
  --user-data-dir=/data/profile \
  --remote-debugging-port=9222 \
  --remote-debugging-address=127.0.0.1 \
  --no-first-run --no-default-browser-check \
  --disable-dev-shm-usage \
  --password-store=basic \
  --lang=pt-BR \
  --window-position=0,0 --window-size=1280,900 \
  --start-maximized \
  https://chatgpt.com/
