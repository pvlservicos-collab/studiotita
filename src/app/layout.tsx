import type { Metadata } from "next";
import "./globals.css";
import TopNav from "@/components/TopNav";

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
        </div>
      </body>
    </html>
  );
}
