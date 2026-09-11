"use client";

import { useEffect, useState } from "react";
import ScriptsBoard from "@/components/ScriptsBoard";
import VideoScripts from "@/components/VideoScripts";
import CategoriesBoard from "@/components/CategoriesBoard";
import DeleteScripts from "@/components/DeleteScripts";

type Tab = "videos" | "gerados" | "categorias" | "excluir";

const TABS: { id: Tab; label: string }[] = [
  { id: "videos", label: "Roteiros dos vídeos" },
  { id: "gerados", label: "Roteiros gerados" },
  { id: "categorias", label: "Categorias" },
  { id: "excluir", label: "Excluir roteiros" },
];

export default function RoteirosPage() {
  const [tab, setTab] = useState<Tab>("videos");

  // permite abrir direto numa aba: /roteiros#categorias (inclusive trocando só o # na barra de endereço)
  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash.replace("#", "") as Tab;
      if (TABS.some((t) => t.id === hash)) setTab(hash);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  function select(id: Tab) {
    setTab(id);
    history.replaceState(null, "", `#${id}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex w-fit flex-wrap gap-1 rounded-full bg-white/60 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => select(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t.id ? "btn-gold" : "text-ink-500 hover:bg-white hover:text-ink-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "videos" && <VideoScripts />}
      {tab === "gerados" && <ScriptsBoard />}
      {tab === "categorias" && <CategoriesBoard onScriptCreated={() => select("gerados")} />}
      {tab === "excluir" && <DeleteScripts />}
    </div>
  );
}
