"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Posts" },
  { href: "/metricas", label: "Métricas" },
  { href: "/roteiros", label: "Roteiros" },
  { href: "/biblioteca", label: "Biblioteca" },
  { href: "/concorrencia", label: "Concorrência" },
  { href: "/integracoes", label: "Integrações" },
  { href: "/estudio-reels", label: "Estúdio Reels" },
  { href: "/video", label: "Vídeo" },
];

export default function TopNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="glass-strong sticky top-4 z-20 flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4 shadow-glass">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Logo" width={36} height={36} className="h-9 w-9 rounded-xl shadow-goldGlow" />
        <div>
          <div className="text-sm font-semibold tracking-tight text-ink-900">Videoteca IG</div>
          <div className="text-[11px] text-ink-400">insights &amp; roteiros</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex flex-wrap items-center gap-1 rounded-full bg-white/60 p-1">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                isActive(tab.href) ? "btn-gold" : "text-ink-500 hover:bg-white hover:text-ink-800"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        {/* botão em destaque, sempre à direita */}
        <Link
          href="/criar-roteiro"
          className={`rounded-full px-5 py-2 text-sm font-semibold shadow-goldGlow transition ${
            isActive("/criar-roteiro") ? "bg-gold-500 text-ink-900" : "bg-ink-900 text-gold-200 hover:bg-ink-800"
          }`}
        >
          ✦ Criar roteiro
        </Link>
      </div>
    </header>
  );
}
