/** Categorias da biblioteca (usadas no painel, no MCP e na importação da pasta "arquivos base"). */
export const FILE_CATEGORIES = [
  { id: "roteiro_antigo", label: "Roteiro antigo" },
  { id: "transcricao_aula", label: "Transcrição de aula" },
  { id: "metodo_roteiro", label: "Método de roteiro" },
  { id: "briefing", label: "Briefing e instruções" },
  { id: "referencia_cientifica", label: "Referência científica" },
  { id: "imagem", label: "Imagem" },
  { id: "outro", label: "Outro" },
];

export const fileCategoryLabel = (id: string) => FILE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
