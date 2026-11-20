/**
 * Hermes: recebe um comando, manda num chat do ChatGPT pelo Chrome logado
 * (o da tela /hermes/tela) e devolve a imagem gerada. Só usa a interface,
 * como uma pessoa: digita no campo, espera a resposta e copia a imagem exibida.
 *
 *   POST /gerar   {prompt, chat_url?, espera_s?}  ou  {job_id, espera_s?}
 *                 -> {status: "pronto"|"gerando"|"na_fila"|"erro", job_id, imagem_url, previa_base64, ...}
 *   GET  /status  -> {logado, chrome, ocupado}
 *   GET  /img/<id>.<ext>   (público, id aleatório)
 *
 * Tudo menos /img e /saude exige "Authorization: Bearer $HERMES_TOKEN".
 * Um comando por vez: usa a aba principal do Chrome (a que aparece na tela).
 */
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const PORT = 8080;
const TOKEN = process.env.HERMES_TOKEN || "";
const PUBLIC_BASE = (process.env.HERMES_PUBLIC_URL || "").replace(/\/+$/, ""); // ex.: https://titacrm.ascensaotita.com/hermes/api
const DEFAULT_CHAT = process.env.HERMES_CHAT_URL || "";
const IMG_DIR = "/data/imagens";
const REF_DIR = "/data/referencias"; // fotos do rosto do Augusto, anexadas quando a imagem é dele
const AVISO_REFERENCIA = "(As fotos anexadas são eu: use-as como referência do meu rosto e do meu físico.)";
const LIMITE_MS = 6 * 60 * 1000; // um comando nunca passa disso
const GUARDAR_DIAS = 30;

// Seletores da interface do ChatGPT (nov/2026). Se o site mudar, é aqui.
const SEL = {
  composer: "[data-chatgpt-composer]",
  campo: '[data-chatgpt-composer] [contenteditable="true"], div[role="textbox"][contenteditable="true"], #prompt-textarea',
  anexarFotos: '[data-chatgpt-composer] input[type="file"][multiple][accept="image/*"]',
  removerAnexo: '[data-chatgpt-composer] button[aria-label^="Remover"], [data-chatgpt-composer] button[aria-label^="Remove"]',
  entrar: '[data-testid="login-button"], button:has-text("Entrar"), button:has-text("Log in")',
  turno: "[data-turn-key]",
  imagem: '[data-testid="generated-image-preview"] img',
  enviar: '[data-testid="send-button"], button[aria-label*="Enviar"], button[aria-label*="Send"]',
  parar: '[data-testid="stop-button"], button[aria-label*="Parar"], button[aria-label*="Interromper"], button[aria-label*="Stop"]',
};

fs.mkdirSync(IMG_DIR, { recursive: true });

/** @type {Map<string, any>} */
const jobs = new Map();
let fila = Promise.resolve();
let ocupado = null; // job_id em andamento

const log = (...a) => console.log(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Falha extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// ------------------------------------------------------------------ Chrome

async function conectar() {
  let ultimo;
  for (let i = 0; i < 10; i++) {
    try {
      return await chromium.connectOverCDP("http://127.0.0.1:9222", { timeout: 10000 });
    } catch (e) {
      ultimo = e;
      await sleep(2000);
    }
  }
  throw new Falha("chrome_fora", `O Chrome do Hermes não respondeu: ${ultimo?.message}`);
}

/** A aba que aparece na tela: com ela visível o ChatGPT carrega as imagens. */
async function abaPrincipal(browser) {
  const ctx = browser.contexts()[0];
  if (!ctx) throw new Falha("chrome_fora", "O Chrome do Hermes está sem janela aberta.");
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.bringToFront();
  return page;
}

async function estaLogado(page) {
  // Logado = campo de mensagem visível e nenhum botão "Entrar" na página.
  const fim = Date.now() + 45000;
  while (Date.now() < fim) {
    if (/auth\.openai\.com|\/auth\/login|accounts\.google/.test(page.url())) return false;
    if (await page.locator(SEL.entrar).first().isVisible().catch(() => false)) return false;
    if (await page.locator(SEL.campo).first().isVisible().catch(() => false)) {
      await sleep(2500); // o botão "Entrar" da página anônima aparece logo depois do campo
      return !(await page.locator(SEL.entrar).first().isVisible().catch(() => false));
    }
    await sleep(1000);
  }
  const titulo = await page.title().catch(() => "");
  if (/just a moment|um momento/i.test(titulo)) {
    throw new Falha("cloudflare", "O ChatGPT pediu verificação de robô (Cloudflare). Abra a tela do Hermes e resolva a verificação uma vez.");
  }
  throw new Falha("chatgpt_nao_carregou", `O ChatGPT não carregou (título: "${titulo}").`);
}

const chavesDosTurnos = (page) =>
  page.evaluate((s) => [...document.querySelectorAll(s)].map((t) => t.getAttribute("data-turn-key")), SEL.turno);

/** Estado das respostas novas (turnos que não existiam antes do envio). */
async function lerNovos(page, antes) {
  return page.evaluate(
    ({ antes, SEL }) => {
      const novos = [...document.querySelectorAll(SEL.turno)].filter((t) => !antes.includes(t.getAttribute("data-turn-key")));
      const estados = novos.map((t) => t.getAttribute("data-talvt-turn-state") || t.querySelector("[data-talvt-turn-state]")?.getAttribute("data-talvt-turn-state") || "");
      const imgs = novos.flatMap((t) =>
        [...t.querySelectorAll(SEL.imagem)].map((img) => ({ src: img.currentSrc || img.src, w: img.naturalWidth, h: img.naturalHeight, ok: img.complete && img.naturalWidth > 0 }))
      );
      const ultimo = novos.at(-1);
      const resp = ultimo?.querySelector('[data-conversation-role="assistant"]')?.parentElement ?? ultimo;
      return { n: novos.length, estados, imgs, texto: (resp?.innerText || "").slice(0, 1500) };
    },
    { antes, SEL }
  );
}

async function gerando(page, estado) {
  if (await page.locator(SEL.parar).first().isVisible().catch(() => false)) return true;
  return estado.estados.some((e) => e && e !== "complete");
}

/** Campo vazio e sem anexos esquecidos (senão iriam junto no envio). */
async function limparCampo(page) {
  await page.keyboard.press("Escape").catch(() => {}); // fecha avisos/modais
  const campo = page.locator(SEL.campo).first();
  await campo.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  for (let i = 0; i < 12; i++) {
    const rm = page.locator(SEL.removerAnexo).first();
    if (!(await rm.count())) break;
    await rm.click({ force: true }); // o "x" só aparece com o mouse em cima
    await sleep(400);
  }
}

/** Anexa as fotos de referência do rosto do Augusto e espera subirem. */
async function anexarReferencias(page) {
  const fotos = fs.existsSync(REF_DIR) ? fs.readdirSync(REF_DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort().map((f) => path.join(REF_DIR, f)) : [];
  if (!fotos.length) throw new Falha("sem_referencias", `Não há fotos de referência em ${REF_DIR} na VPS.`);
  await page.locator(SEL.anexarFotos).first().setInputFiles(fotos);
  const fim = Date.now() + 90000;
  while (Date.now() < fim) {
    await sleep(1500);
    const n = await page.locator(SEL.removerAnexo).count();
    const ocupado = await page.locator(`${SEL.composer} [aria-busy="true"], ${SEL.composer} [role="progressbar"]`).count();
    if (n >= fotos.length && !ocupado) {
      await sleep(2000);
      return fotos.length;
    }
  }
  throw new Falha("anexo_falhou", "As fotos de referência não terminaram de subir no ChatGPT em 90 s.");
}

async function digitar(page, prompt) {
  const campo = page.locator(SEL.campo).first();
  await campo.click();
  const linhas = prompt.replace(/\r/g, "").split("\n");
  for (let i = 0; i < linhas.length; i++) {
    if (i > 0) await page.keyboard.press("Shift+Enter");
    if (linhas[i]) await page.keyboard.insertText(linhas[i]);
  }
  await sleep(800);
  const enviar = page.locator(SEL.enviar).first();
  // Com anexos o "Enviar" pode ficar desligado enquanto o upload termina.
  for (let i = 0; i < 30 && (await enviar.isDisabled().catch(() => false)); i++) await sleep(1000);
  if (await enviar.isVisible().catch(() => false)) await enviar.click();
  else await page.keyboard.press("Enter");
}

/** Copia a imagem exibida (o mesmo arquivo que o navegador mostra) e, se falhar, tira print dela. */
async function baixar(page, src) {
  const r = await page
    .evaluate(async (u) => {
      const res = await fetch(u);
      if (!res.ok) return null;
      const buf = new Uint8Array(await res.arrayBuffer());
      let s = "";
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { b64: btoa(s), mime: res.headers.get("content-type") || "image/png" };
    }, src)
    .catch(() => null);
  if (r) return { buf: Buffer.from(r.b64, "base64"), mime: r.mime };
  const el = page.locator(SEL.imagem).last();
  return { buf: await el.screenshot(), mime: "image/png", print: true };
}

/** Prévia em JPEG pequena (até 768 px) para o Claude ver a imagem sem estourar a resposta. */
async function previa(page, buf, mime) {
  return page
    .evaluate(
      async ({ b64, mime }) => {
        const img = new Image();
        img.src = `data:${mime};base64,${b64}`;
        await img.decode();
        const k = Math.min(1, 768 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * k);
        c.height = Math.round(img.naturalHeight * k);
        const g = c.getContext("2d");
        g.fillStyle = "#fff"; // PNG transparente vira fundo branco no JPEG (senão fica preto)
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL("image/jpeg", 0.82).split(",")[1];
      },
      { b64: buf.toString("base64"), mime }
    )
    .catch(() => null);
}

function extensao(mime) {
  if (/webp/.test(mime)) return "webp";
  if (/jpe?g/.test(mime)) return "jpg";
  return "png";
}

// ------------------------------------------------------------------ comando

async function executar(job) {
  const browser = await conectar();
  try {
    const page = await abaPrincipal(browser);
    job.etapa = "abrindo o chat";
    await page.goto(job.chat_url, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (!(await estaLogado(page))) {
      throw new Falha("nao_logado", "O Hermes não está logado no ChatGPT. Abra a tela do Hermes e entre na conta uma vez.");
    }
    await sleep(4000); // a conversa antiga termina de montar
    const antes = await chavesDosTurnos(page);

    await limparCampo(page);
    let referencias = 0;
    if (job.usar_rosto) {
      job.etapa = "anexando as fotos do Augusto";
      referencias = await anexarReferencias(page);
    }
    job.etapa = "enviando o comando";
    await digitar(page, job.usar_rosto ? `${job.prompt}\n\n${AVISO_REFERENCIA}` : job.prompt);

    job.etapa = "esperando o ChatGPT";
    let candidata = null;
    let desde = 0;
    let semImagemDesde = 0;
    let estado = { n: 0, estados: [], imgs: [], texto: "" };
    while (Date.now() - job.inicio < LIMITE_MS) {
      await sleep(2500);
      await page.locator(SEL.turno).last().scrollIntoViewIfNeeded().catch(() => {});
      estado = await lerNovos(page, antes);
      const ainda = await gerando(page, estado);
      const ultima = estado.imgs.filter((i) => i.ok && i.w >= 256).at(-1);
      if (ultima) job.etapa = "imagem aparecendo";
      if (ultima && ultima.src === candidata?.src && ultima.w === candidata?.w) {
        // Pronta = mesma imagem por 6 s com a resposta concluída.
        if (!ainda && Date.now() - desde > 6000) break;
      } else if (ultima) {
        candidata = ultima;
        desde = Date.now();
      }
      // Resposta concluída sem imagem nenhuma: devolve o texto do ChatGPT.
      if (estado.n > 0 && !ainda && !ultima && estado.estados.every((e) => e === "complete")) {
        semImagemDesde ||= Date.now();
        if (Date.now() - semImagemDesde > 20000) {
          throw new Falha("sem_imagem", `O ChatGPT respondeu sem gerar imagem: ${estado.texto}`);
        }
      } else semImagemDesde = 0;
    }
    if (!candidata) throw new Falha("demorou", "O ChatGPT não entregou a imagem em 6 minutos.");

    job.etapa = "baixando a imagem";
    const { buf, mime, print } = await baixar(page, candidata.src);
    const id = crypto.randomBytes(12).toString("hex");
    const arquivo = `${id}.${extensao(mime)}`;
    fs.writeFileSync(path.join(IMG_DIR, arquivo), buf);
    return {
      imagem_url: `${PUBLIC_BASE}/img/${arquivo}`,
      largura: candidata.w,
      altura: candidata.h,
      bytes: buf.length,
      mime,
      fotos_de_referencia_anexadas: referencias,
      ...(print ? { aviso: "A cópia direta falhou; a imagem veio por print da tela (qualidade de tela)." } : {}),
      previa_base64: await previa(page, buf, mime),
      // Só texto de verdade; rótulos de botão como "Editar" ficam de fora.
      texto_do_chatgpt: ((t) => (t.length > 25 ? t.slice(0, 1000) : undefined))(
        estado.texto.replace(/^ChatGPT disse:\s*/i, "").split("\n").filter((l) => !/^(Editar|Copiar|Compartilhar)$/i.test(l.trim())).join("\n").trim()
      ),
      chat_url: page.url(),
    };
  } finally {
    // Desconecta sem fechar o Chrome (é ele que guarda o login).
    await browser.close().catch(() => {});
  }
}

function novoJob(prompt, chat_url, usar_rosto) {
  const job = { id: crypto.randomUUID(), prompt, chat_url, usar_rosto, status: "na_fila", etapa: "na fila", inicio: 0, criado: Date.now() };
  jobs.set(job.id, job);
  job.feito = (fila = fila.then(async () => {
    job.status = "gerando";
    job.inicio = Date.now();
    ocupado = job.id;
    log("job", job.id, "começou");
    try {
      job.resultado = await executar(job);
      job.status = "pronto";
      log("job", job.id, "pronto", job.resultado.imagem_url);
    } catch (e) {
      job.status = "erro";
      job.erro = { code: e.code || "erro", message: e.message };
      log("job", job.id, "erro", e.code, e.message);
    } finally {
      ocupado = null;
      job.fim = Date.now();
    }
  }));
  return job;
}

function visao(job) {
  const base = { status: job.status, job_id: job.id, etapa: job.etapa, segundos: Math.round(((job.fim || Date.now()) - (job.inicio || job.criado)) / 1000) };
  if (job.status === "pronto") return { ...base, ...job.resultado };
  if (job.status === "erro") return { ...base, erro: job.erro };
  return base;
}

/** Comando novo ou continuação (job_id); espera até `esperaMs` e devolve o estado. */
async function pedir(b, esperaMs) {
  let job;
  if (b.job_id) {
    job = jobs.get(String(b.job_id));
    if (!job) throw new Falha("pedido", "job_id não existe (o Hermes reiniciou ou já passou muito tempo). Mande o comando de novo.");
  } else {
    const prompt = String(b.prompt || "").trim();
    if (!prompt) throw new Falha("pedido", "Falta o prompt (o comando de criação da imagem).");
    const chat = String(b.chat_url || DEFAULT_CHAT).trim();
    if (!/^https:\/\/chatgpt\.com\//.test(chat)) throw new Falha("pedido", "chat_url precisa ser um link https://chatgpt.com/...");
    job = novoJob(prompt, chat, !!(b.usar_rosto ?? b.usar_rosto_do_augusto));
  }
  await Promise.race([job.feito, sleep(esperaMs)]);
  return visao(job);
}

// ------------------------------------------------------------------ HTTP

function responder(res, code, body) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function autorizado(req) {
  if (!TOKEN) return false;
  const t = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  return t.length === TOKEN.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(TOKEN));
}

async function corpo(req) {
  let s = "";
  for await (const c of req) {
    s += c;
    if (s.length > 200_000) throw new Falha("grande", "Comando grande demais.");
  }
  return s ? JSON.parse(s) : {};
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    try {
      const img = url.pathname.match(/^\/img\/([a-f0-9]{24}\.(png|jpg|webp))$/);
      if (req.method === "GET" && img) {
        const f = path.join(IMG_DIR, img[1]);
        if (!fs.existsSync(f)) return responder(res, 404, { error: "Imagem não encontrada (some depois de 30 dias)." });
        res.writeHead(200, { "content-type": img[2] === "jpg" ? "image/jpeg" : `image/${img[2]}`, "cache-control": "public, max-age=31536000, immutable" });
        return fs.createReadStream(f).pipe(res);
      }
      if (url.pathname === "/" || url.pathname === "/saude") return responder(res, 200, { ok: true, servico: "hermes" });
      if (!autorizado(req)) return responder(res, 401, { error: "Não autorizado." });

      if (req.method === "GET" && url.pathname === "/status") {
        if (ocupado) return responder(res, 200, { chrome: true, ocupado });
        const browser = await conectar();
        try {
          const page = await abaPrincipal(browser);
          if (!/chatgpt\.com/.test(page.url())) await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
          return responder(res, 200, { chrome: true, logado: await estaLogado(page), ocupado, aba: page.url() });
        } finally {
          await browser.close().catch(() => {});
        }
      }

      if (req.method === "POST" && url.pathname === "/gerar") {
        const b = await corpo(req);
        try {
          return responder(res, 200, await pedir(b, Math.min(Math.max(Number(b.espera_s) || 240, 0), 280) * 1000));
        } catch (e) {
          if (e instanceof Falha && e.code === "pedido") return responder(res, 400, { error: e.message });
          throw e;
        }
      }

      return responder(res, 404, { error: "Rota não existe." });
    } catch (e) {
      log("erro http", e.message);
      return responder(res, e instanceof Falha ? 503 : 500, { error: e.message, code: e.code });
    }
  })
  .listen(PORT, () => log(`hermes ouvindo em :${PORT}`));

// Limpeza: imagens velhas e jobs antigos na memória.
setInterval(() => {
  const limite = Date.now() - GUARDAR_DIAS * 86400_000;
  for (const f of fs.readdirSync(IMG_DIR)) {
    const p = path.join(IMG_DIR, f);
    if (fs.statSync(p).mtimeMs < limite) fs.unlinkSync(p);
  }
  for (const [id, j] of jobs) if (j.fim && Date.now() - j.fim > 6 * 3600_000) jobs.delete(id);
}, 3600_000);
