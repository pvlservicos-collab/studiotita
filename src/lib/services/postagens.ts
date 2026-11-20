/**
 * Postador do Instagram.
 *
 * 1. O Claude do Augusto termina o vídeo e chama preparar_postagem no conector:
 *    nasce um rascunho com um link temporário (/postar/<token>).
 * 2. O vídeo vai para a VPS (o próprio Augusto arrasta na página, o Claude envia
 *    com o link de upload assinado, ou a VPS baixa de um link público).
 * 3. No link, o Augusto revisa cada campo da Meta e clica em Postar ou Agendar.
 *    Ninguém publica sem esse clique.
 * 4. A publicação anda em etapas (criar o container na Meta → esperar o vídeo
 *    processar → publicar). Quem empurra as etapas é a própria página (enquanto
 *    está aberta) e o cron da VPS, de 5 em 5 minutos (é ele que faz o agendamento:
 *    a API do Instagram não agenda sozinha).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import { metaGraphRequest, metaIds } from "@/lib/meta";
import { appUrl } from "@/lib/appUrl";

export class PostagemInputError extends Error {}

export const STATUS = ["rascunho", "agendado", "fila", "processando", "publicado", "erro"] as const;
export type StatusPostagem = (typeof STATUS)[number];
export const TRIAL = ["MANUAL", "SS_PERFORMANCE"] as const;

export interface PostagemRow {
  id: string;
  token: string;
  status: StatusPostagem;
  title: string | null;
  video_url: string | null;
  cover_url: string | null;
  caption: string;
  share_to_feed: boolean;
  thumb_offset: number | null;
  audio_name: string | null;
  location_id: string | null;
  user_tags: string[];
  collaborators: string[];
  trial_strategy: (typeof TRIAL)[number] | null;
  comments_enabled: boolean;
  first_comment: string | null;
  scheduled_at: string | null;
  container_id: string | null;
  media_id: string | null;
  permalink: string | null;
  error_message: string | null;
  attempts: number;
  created_by: string | null;
  expires_at: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------ configuração
function vps() {
  const base = process.env.VPS_VIDEOS_URL?.replace(/\/+$/, "");
  const secret = process.env.POSTAGEM_SECRET;
  if (!base || !secret) {
    throw new PostagemInputError("O postador não está configurado no servidor: faltam VPS_VIDEOS_URL e/ou POSTAGEM_SECRET nas variáveis de ambiente.");
  }
  return { base, secret };
}

type Kind = "video" | "capa";
const EXT: Record<Kind, string> = { video: "mp4", capa: "jpg" };

/** Assinatura que a VPS confere antes de aceitar um arquivo (mesma conta do servidor de upload). */
function sign(id: string, kind: Kind, exp: number) {
  return createHmac("sha256", vps().secret).update(`${id}.${kind}.${exp}`).digest("hex");
}

/** Links assinados para enviar o vídeo/capa direto para a VPS (valem 6 horas). */
export function uploadLinks(id: string) {
  const { base } = vps();
  const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
  const make = (kind: Kind) => {
    const qs = `exp=${exp}&sig=${sign(id, kind, exp)}`;
    return {
      enviar: `${base}/upload/${id}/${kind}?${qs}`, // PUT com o arquivo no corpo
      baixar_de_link: `${base}/fetch/${id}/${kind}?${qs}`, // POST {"url": "..."}: a VPS baixa
      publico: `${base}/v/${id}-${kind}.${EXT[kind]}`,
    };
  };
  return { expira_em: new Date(exp * 1000).toISOString(), video: make("video"), capa: make("capa") };
}

/** Só aceita links do próprio armazenamento da VPS (a Meta busca o vídeo daí). */
function assertVpsUrl(url: string | null | undefined) {
  if (!url) return null;
  if (!url.startsWith(`${vps().base}/v/`)) throw new PostagemInputError("O vídeo e a capa precisam estar no armazenamento da VPS.");
  return url;
}

export function checkCronSecret(header: string | null) {
  const secret = process.env.POSTAGEM_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ------------------------------------------------------------ leitura e edição
export function linkDaPostagem(token: string) {
  return `${appUrl()}/postar/${token}`;
}

export async function getByToken(token: string) {
  const p = await queryOne<PostagemRow>(`select * from postagens where token = $1`, [token]);
  if (!p) throw new PostagemInputError("Link de postagem não encontrado.");
  if (p.status !== "publicado" && new Date(p.expires_at) < new Date()) {
    throw new PostagemInputError("Este link de postagem expirou. Peça ao Claude para preparar de novo.");
  }
  return p;
}

export async function getById(id: string) {
  return queryOne<PostagemRow>(`select * from postagens where id = $1`, [id]);
}

/** Se o vídeo/capa já chegaram na VPS (enviados por fora da página), registra o link. */
async function detectUploads(p: PostagemRow) {
  if (p.video_url && p.cover_url) return p;
  const links = uploadLinks(p.id);
  const exists = async (url: string) => {
    try {
      return (await fetch(url, { method: "HEAD", cache: "no-store" })).ok;
    } catch {
      return false;
    }
  };
  const video = p.video_url ?? ((await exists(links.video.publico)) ? links.video.publico : null);
  const cover = p.cover_url ?? ((await exists(links.capa.publico)) ? links.capa.publico : null);
  if (video === p.video_url && cover === p.cover_url) return p;
  return (await queryOne<PostagemRow>(`update postagens set video_url = $2, cover_url = $3, updated_at = now() where id = $1 returning *`, [p.id, video, cover]))!;
}

export interface CamposPostagem {
  title?: string | null;
  caption?: string;
  share_to_feed?: boolean;
  thumb_offset?: number | null;
  audio_name?: string | null;
  location_id?: string | null;
  user_tags?: string[];
  collaborators?: string[];
  trial_strategy?: (typeof TRIAL)[number] | null;
  comments_enabled?: boolean;
  first_comment?: string | null;
  video_url?: string | null;
  cover_url?: string | null;
}

const cleanUsers = (list: string[] | undefined) =>
  list === undefined ? undefined : [...new Set(list.map((u) => u.replace(/^@/, "").trim().toLowerCase()).filter((u) => /^[a-z0-9._]{1,30}$/.test(u)))];

/** Regras da Meta para Reels, conferidas antes de mandar (a mensagem já diz o que corrigir). */
function validate(c: CamposPostagem) {
  if (c.caption !== undefined) {
    if (c.caption.length > 2200) throw new PostagemInputError(`A legenda tem ${c.caption.length} caracteres; o Instagram aceita até 2.200.`);
    const tags = c.caption.match(/(^|\s)#[^\s#]+/g)?.length ?? 0;
    if (tags > 30) throw new PostagemInputError(`A legenda tem ${tags} hashtags; o Instagram aceita até 30.`);
    const mentions = c.caption.match(/(^|\s)@[a-z0-9._]+/gi)?.length ?? 0;
    if (mentions > 20) throw new PostagemInputError(`A legenda marca ${mentions} perfis; o Instagram aceita até 20.`);
  }
  if (c.collaborators && c.collaborators.length > 3) throw new PostagemInputError("O Instagram aceita no máximo 3 colaboradores.");
  if (c.user_tags && c.user_tags.length > 20) throw new PostagemInputError("O Instagram aceita no máximo 20 pessoas marcadas.");
  if (c.trial_strategy && !TRIAL.includes(c.trial_strategy)) throw new PostagemInputError("Reel de teste: use MANUAL ou SS_PERFORMANCE.");
  if (c.thumb_offset != null && (!Number.isFinite(c.thumb_offset) || c.thumb_offset < 0)) throw new PostagemInputError("O frame da capa precisa ser um tempo válido.");
  if (c.location_id && !/^\d+$/.test(c.location_id)) throw new PostagemInputError("A localização é o ID numérico de uma Página do Facebook com endereço.");
}

const EDITAVEL: StatusPostagem[] = ["rascunho", "agendado", "erro"];

export async function createPostagem(c: CamposPostagem, createdBy: string) {
  const campos = { ...c, user_tags: cleanUsers(c.user_tags), collaborators: cleanUsers(c.collaborators) };
  validate(campos);
  const token = randomBytes(24).toString("base64url");
  const p = await queryOne<PostagemRow>(
    `insert into postagens (token, title, caption, share_to_feed, thumb_offset, audio_name, location_id, user_tags, collaborators,
                            trial_strategy, comments_enabled, first_comment, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning *`,
    [
      token,
      campos.title ?? null,
      campos.caption ?? "",
      campos.share_to_feed ?? true,
      campos.thumb_offset ?? null,
      campos.audio_name || null,
      campos.location_id || null,
      campos.user_tags ?? [],
      campos.collaborators ?? [],
      campos.trial_strategy ?? null,
      campos.comments_enabled ?? true,
      campos.first_comment || null,
      createdBy,
    ]
  );
  return p!;
}

/** A VPS baixa o vídeo (ou a capa) de um link público, sem passar o arquivo pela Vercel. */
export async function vpsFetch(id: string, kind: Kind, url: string) {
  const r = await fetch(uploadLinks(id)[kind].baixar_de_link, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new PostagemInputError(`A VPS não conseguiu baixar o ${kind === "video" ? "vídeo" : "capa"}: ${d.error ?? r.statusText}. O link precisa ser direto para o arquivo e público.`);
  return d.url as string;
}

export async function updatePostagem(token: string, c: CamposPostagem) {
  const p = await getByToken(token);
  if (!EDITAVEL.includes(p.status)) throw new PostagemInputError("Esta postagem já está sendo publicada e não pode mais ser editada.");
  const campos: CamposPostagem = {
    ...c,
    user_tags: cleanUsers(c.user_tags),
    collaborators: cleanUsers(c.collaborators),
    video_url: c.video_url === undefined ? undefined : assertVpsUrl(c.video_url),
    cover_url: c.cover_url === undefined ? undefined : assertVpsUrl(c.cover_url),
  };
  validate(campos);
  const cols = [
    "title", "caption", "share_to_feed", "thumb_offset", "audio_name", "location_id", "user_tags", "collaborators",
    "trial_strategy", "comments_enabled", "first_comment", "video_url", "cover_url",
  ] as const;
  const sets: string[] = [];
  const vals: unknown[] = [p.id];
  for (const col of cols) {
    const v = campos[col];
    if (v === undefined) continue;
    vals.push(typeof v === "string" && v.trim() === "" && col !== "caption" ? null : v);
    sets.push(`${col} = $${vals.length}`);
  }
  // editar uma que deu erro volta para rascunho (e descarta o container antigo)
  if (p.status === "erro") sets.push(`status = 'rascunho', error_message = null, container_id = null`);
  if (!sets.length) return p;
  return (await queryOne<PostagemRow>(`update postagens set ${sets.join(", ")}, updated_at = now() where id = $1 returning *`, vals))!;
}

/** O que a página (e o Claude) podem ver — nunca o token de outra postagem nem segredos. */
export async function publicView(token: string) {
  let p = await getByToken(token);
  if (p.status === "fila" || p.status === "processando" || (p.status === "agendado" && p.scheduled_at && new Date(p.scheduled_at) <= new Date())) {
    p = await advance(p.id);
  }
  p = await detectUploads(p);
  const { token: _t, ...rest } = p;
  return {
    postagem: rest,
    upload: EDITAVEL.includes(p.status) ? uploadLinks(p.id) : null,
    conta: process.env.INSTAGRAM_USERNAME || "augustotita",
  };
}

// ------------------------------------------------------------ publicar / agendar
export async function publicar(token: string, quando?: string | null) {
  const p = await getByToken(token);
  if (!EDITAVEL.includes(p.status)) throw new PostagemInputError("Esta postagem já está sendo publicada.");
  if (!p.video_url) throw new PostagemInputError("Falta o vídeo: envie o arquivo antes de postar.");
  if (quando) {
    const at = new Date(quando);
    if (Number.isNaN(at.getTime())) throw new PostagemInputError("Data do agendamento inválida.");
    if (at.getTime() < Date.now() + 5 * 60_000) throw new PostagemInputError("Agende para pelo menos 5 minutos a partir de agora (o cron confere de 5 em 5 minutos).");
    if (at > new Date(p.expires_at)) throw new PostagemInputError("O agendamento passa da validade do link (14 dias).");
    return (await queryOne<PostagemRow>(
      `update postagens set status = 'agendado', scheduled_at = $2, error_message = null, container_id = null, updated_at = now() where id = $1 returning *`,
      [p.id, at.toISOString()]
    ))!;
  }
  await query(`update postagens set status = 'fila', scheduled_at = null, error_message = null, container_id = null, attempts = 0, updated_at = now() where id = $1`, [p.id]);
  return advance(p.id);
}

export async function cancelarAgendamento(token: string) {
  const p = await getByToken(token);
  if (p.status !== "agendado") throw new PostagemInputError("Esta postagem não está agendada.");
  return (await queryOne<PostagemRow>(`update postagens set status = 'rascunho', scheduled_at = null, updated_at = now() where id = $1 returning *`, [p.id]))!;
}

/** Trava curta: a página e o cron nunca publicam a mesma postagem duas vezes. */
async function claim(id: string) {
  return queryOne<PostagemRow>(
    `update postagens set locked_until = now() + interval '90 seconds'
      where id = $1 and (locked_until is null or locked_until < now()) returning *`,
    [id]
  );
}

const fail = (id: string, msg: string) =>
  queryOne<PostagemRow>(`update postagens set status = 'erro', error_message = $2, locked_until = null, updated_at = now() where id = $1 returning *`, [id, msg]);

/**
 * Anda uma etapa: cria o container na Meta, confere se o vídeo terminou de
 * processar e publica. Pode ser chamada quantas vezes for (idempotente).
 */
export async function advance(id: string): Promise<PostagemRow> {
  const p = await claim(id);
  if (!p) return (await getById(id))!; // outra chamada está cuidando dela agora
  try {
    const due = p.status === "fila" || (p.status === "agendado" && p.scheduled_at && new Date(p.scheduled_at) <= new Date());
    if (due && !p.container_id) {
      const { igUserId } = metaIds();
      const params: Record<string, string> = {
        media_type: "REELS",
        video_url: p.video_url!,
        caption: p.caption ?? "",
        share_to_feed: String(p.share_to_feed),
      };
      if (p.cover_url) params.cover_url = p.cover_url;
      else if (p.thumb_offset != null) params.thumb_offset = String(Math.round(p.thumb_offset));
      if (p.audio_name) params.audio_name = p.audio_name;
      if (p.location_id) params.location_id = p.location_id;
      if (p.user_tags.length) params.user_tags = JSON.stringify(p.user_tags.map((username) => ({ username })));
      if (p.collaborators.length) params.collaborators = JSON.stringify(p.collaborators);
      if (p.trial_strategy) params.trial_params = JSON.stringify({ graduation_strategy: p.trial_strategy });
      const c = await metaGraphRequest("POST", `${igUserId}/media`, params);
      return (await queryOne<PostagemRow>(
        `update postagens set status = 'processando', container_id = $2, attempts = attempts + 1, locked_until = null, updated_at = now() where id = $1 returning *`,
        [p.id, c.id]
      ))!;
    }

    if (p.status === "processando" && p.container_id) {
      const st = await metaGraphRequest("GET", p.container_id, { fields: "status_code,status" });
      if (st.status_code === "ERROR" || st.status_code === "EXPIRED") {
        return (await fail(p.id, `A Meta recusou o vídeo (${st.status_code}): ${st.status ?? "sem detalhe"}. Confira o formato (MP4/MOV, H.264, 3 s a 15 min, 9:16).`))!;
      }
      if (st.status_code !== "FINISHED") {
        // a Meta ainda está processando o vídeo; desiste depois de 1 hora
        if (Date.now() - new Date(p.updated_at).getTime() > 3600_000) return (await fail(p.id, "A Meta passou de 1 hora processando o vídeo. Tente postar de novo."))!;
        await query(`update postagens set locked_until = null where id = $1`, [p.id]);
        return (await getById(p.id))!;
      }
      const { igUserId } = metaIds();
      const pub = await metaGraphRequest("POST", `${igUserId}/media_publish`, { creation_id: p.container_id });
      // a partir daqui o post existe: registra antes dos extras, que não podem derrubar a publicação
      let row = (await queryOne<PostagemRow>(
        `update postagens set status = 'publicado', media_id = $2, published_at = now(), locked_until = null, updated_at = now() where id = $1 returning *`,
        [p.id, pub.id]
      ))!;
      const extras: string[] = [];
      try {
        const m = await metaGraphRequest("GET", pub.id, { fields: "permalink" });
        row = (await queryOne<PostagemRow>(`update postagens set permalink = $2 where id = $1 returning *`, [p.id, m.permalink ?? null]))!;
      } catch {
        /* o link aparece na próxima leitura */
      }
      if (!p.comments_enabled) {
        try {
          await metaGraphRequest("POST", pub.id, { comment_enabled: "false" });
        } catch (e) {
          extras.push(`não consegui desligar os comentários (${(e as Error).message})`);
        }
      }
      if (p.first_comment) {
        try {
          await metaGraphRequest("POST", `${pub.id}/comments`, { message: p.first_comment });
        } catch (e) {
          extras.push(`não consegui fazer o primeiro comentário (${(e as Error).message})`);
        }
      }
      if (extras.length) row = (await queryOne<PostagemRow>(`update postagens set error_message = $2 where id = $1 returning *`, [p.id, `Publicado, mas ${extras.join("; ")}.`]))!;
      return row;
    }

    await query(`update postagens set locked_until = null where id = $1`, [p.id]);
    return (await getById(p.id))!;
  } catch (err) {
    return (await fail(p.id, (err as Error).message))!;
  }
}

/** Cron da VPS: empurra as agendadas que venceram e as que estão processando. */
export async function runDue() {
  const rows = await query<{ id: string }>(
    `select id from postagens
      where status in ('fila', 'processando') or (status = 'agendado' and scheduled_at <= now())
      order by coalesce(scheduled_at, created_at) limit 20`
  );
  const out = [];
  for (const r of rows) {
    const p = await advance(r.id);
    out.push({ id: p.id, status: p.status, permalink: p.permalink, erro: p.error_message });
  }
  return { quando: new Date().toISOString(), processadas: out };
}

/** Para o Claude: o resumo de uma postagem que ele preparou. */
export function resumo(p: PostagemRow) {
  return {
    id: p.id,
    status: p.status,
    titulo: p.title,
    link_para_o_augusto: linkDaPostagem(p.token),
    tem_video: Boolean(p.video_url),
    agendada_para: p.scheduled_at,
    publicada_em: p.published_at,
    instagram: p.permalink,
    erro: p.error_message,
    expira_em: p.expires_at,
  };
}
