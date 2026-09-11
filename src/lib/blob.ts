/**
 * Helper fino sobre @vercel/blob para guardar cópias de vídeo/roteiros
 * quando necessário. Uso opcional — o app funciona normalmente sem
 * BLOB_READ_WRITE_TOKEN configurado (só não guarda cópia própria do vídeo).
 */
import { put } from "@vercel/blob";

export class BlobConfigError extends Error {}

export async function uploadVideoCopy(fileName: string, source: Blob | ArrayBuffer | Buffer) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new BlobConfigError(
      "BLOB_READ_WRITE_TOKEN não configurado. Defina no .env.local para habilitar cópias no Vercel Blob."
    );
  }
  const result = await put(fileName, source as any, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return result.url;
}
