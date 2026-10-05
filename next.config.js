/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Leitores de PDF/DOCX da biblioteca de arquivos rodam como pacotes Node puros.
    // binários nativos do render de vídeo ficam fora do bundle do webpack
    serverComponentsExternalPackages: ["unpdf", "mammoth", "@napi-rs/canvas", "ffmpeg-static"],
    // o ffmpeg e as fontes precisam ir junto com a função de render
    outputFileTracingIncludes: {
      "/api/video-projects/**": ["./fontes/**", "./node_modules/ffmpeg-static/**", "./node_modules/@napi-rs/canvas*/**"],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
};

module.exports = nextConfig;
