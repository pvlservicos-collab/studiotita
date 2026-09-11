"use client";

import { useEffect, useState } from "react";
import ScriptsBoard from "@/components/ScriptsBoard";
import CategoriesBoard from "@/components/CategoriesBoard";
import DeleteScripts from "@/components/DeleteScripts";

type Tab = "roteiros" | "categorias" | "excluir";

const TABS: { id: Tab; label: string }[] = [
  { id: "roteiros", label: "Roteiros" },
  { id: "categorias", label: "Categorias" },
  { id: "excluir", label: "Excluir roteiros" },
];

export default function RoteirosPage() {
  const [tab, setTab] = useState<Tab>("roteiros");

  // permite abrir direto numa aba: /roteiros#categorias
  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as Tab;
    if (TABS.some((t) => t.id === hash)) setTab(hash);
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
      {tab === "roteiros" && <ScriptsBoard />}
      {tab === "categorias" && <CategoriesBoard onScriptCreated={() => select("roteiros")} />}
      {tab === "excluir" && <DeleteScripts />}
    </div>
  );
}
