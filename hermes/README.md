# Hermes (imagens no ChatGPT)

Agente na VPS do Titã (`ssh tita-vps`, `/docker/hermes`). Um Chrome de verdade,
logado na conta do ChatGPT do Augusto, roda numa tela virtual. O Hermes abre o
chat do projeto "Imagens Reels", digita o comando, espera a imagem e devolve o link.

O Augusto usa pelo conector da Videoteca (o mesmo de sempre, na Vercel):
tool `gerar_imagem` (`prompt`, `usar_rosto_do_augusto`, `job_id`, `chat_url`), em
`src/mcp/tools.ts` + `src/lib/services/hermes.ts`, que chama `POST /gerar` daqui. Cada chamada espera até 50 s; se ainda estiver gerando, volta `job_id` e o Claude
chama de novo só com ele. Com `usar_rosto_do_augusto=true` o Hermes anexa as fotos
de `data/referencias/` (as 4 fotos de palco do Augusto) antes de enviar.

| O quê | Onde |
|---|---|
| Fotos de referência do rosto | `/docker/hermes/data/referencias/` (troque os arquivos para mudar; vão todas, em ordem alfabética) |
| Tela do Chrome (login) | `https://titacrm.ascensaotita.com/hermes/tela/vnc.html?path=hermes/tela/websockify&autoconnect=1&resize=scale`, com usuário e senha em `/docker/hermes/tela-senha.txt` |
| API | `https://titacrm.ascensaotita.com/hermes/api` (`Bearer HERMES_TOKEN`) |
| Segredos | `/docker/hermes/.env` (`HERMES_TOKEN`, chat padrão, hash da senha da tela) |
| Perfil do Chrome (sessão do ChatGPT) | `/docker/hermes/data/profile` |
| Imagens geradas | `/docker/hermes/data/imagens`, públicas em `/hermes/api/img/<id>.png`, apagadas após 30 dias |

Na Vercel: `HERMES_URL=https://titacrm.ascensaotita.com/hermes/api` e `HERMES_TOKEN`.

## Comandos

```sh
ssh tita-vps
cd /docker/hermes
./instalar.sh                 # instala/atualiza (gera .env na 1ª vez)
docker compose logs -f        # o que o Hermes está fazendo
docker compose restart        # Chrome travou
```

## Quando para de funcionar

- **"não está logado" ou "Cloudflare"**: abra a tela, entre na conta ou resolva a verificação. A sessão fica salva no perfil.
- **Não acha a imagem ou o campo de texto**: o ChatGPT mudou o site. Os seletores ficam no topo de `server.mjs` (`SEL`: campo `[data-chatgpt-composer] [contenteditable]`, turnos `[data-turn-key]` com `data-talvt-turn-state="complete"`, imagem `[data-testid="generated-image-preview"] img`). O Hermes só usa a interface: a aba principal fica visível (sem isso o ChatGPT não carrega as imagens) e a imagem é copiada do que está na tela.
- O login é da conta do Augusto (Google). Se cair, entre de novo pela tela, à mão: o Google recusa login feito por automação.
- Automatizar a interface do ChatGPT vai contra os termos da OpenAI. Use pouco e uma imagem por vez.
