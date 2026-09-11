/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Leitores de PDF/DOCX da biblioteca de arquivos rodam como pacotes Node puros.
    serverComponentsExternalPackages: ["unpdf", "mammoth"],
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
