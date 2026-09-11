import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import TopNav from "@/components/TopNav";
import { LEGAL, LEGAL_LINKS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Videoteca IG — Insights",
  description: "Biblioteca de vídeos do Instagram, roteiros e análises de IA.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">
        <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col px-4 pb-16 pt-6 sm:px-8">
          <TopNav />
          <main className="mt-6 flex-1">{children}</main>
          <footer className="mt-12 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-ink-400">
            <span>© {new Date().getFullYear()} {LEGAL.appName}</span>
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-ink-600 hover:underline">
                {link.label}
              </Link>
            ))}
          </footer>
        </div>
      </body>
    </html>
  );
}
