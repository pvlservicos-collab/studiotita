"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Vídeos" },
  { href: "/metricas", label: "Métricas" },
  { href: "/roteiros", label: "Roteiros" },
  { href: "/biblioteca", label: "Biblioteca" },
  { href: "/integracoes", label: "Integrações" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <header className="glass-strong sticky top-4 z-20 flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4 shadow-glass">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold-300 to-gold-600 text-sm font-bold text-white shadow-goldGlow">
          IG
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight text-ink-900">Videoteca IG</div>
          <div className="text-[11px] text-ink-400">insights &amp; roteiros</div>
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-1 rounded-full bg-white/60 p-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                active
                  ? "btn-gold"
                  : "text-ink-500 hover:bg-white hover:text-ink-800"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
