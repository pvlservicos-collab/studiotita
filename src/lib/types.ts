export interface VideoRow {
  id: string;
  ig_media_id: string | null;
  source: "meta" | "manual" | "claude_code";
  caption: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  blob_url: string | null;
  permalink: string | null;
  posted_at: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  /** Todas as métricas da Meta para a mídia (tempos em ms, reels_skip_rate em %). */
  metrics: Record<string, number> | null;
  metrics_updated_at: string | null;
  created_at: string;
  updated_at: string;
  latest_analysis_id?: string | null;
  latest_analysis_status?: AnalysisStatus | null;
  latest_analysis_summary?: string | null;
}

export type AnalysisStatus = "pending" | "processing" | "done" | "error";

export interface AnalysisRow {
  id: string;
  video_id: string;
  script_id: string | null;
  status: AnalysisStatus;
  summary: string | null;
  transcript: string | null;
  /** Adequação às regras do Augusto — preenchida depois, à mão ou pelo Claude. */
  rules_fit: string | null;
  /** Campo das análises antigas (antes do prompt com resumo + transcrição). */
  patterns: string | null;
  prompt: string | null;
  model: string | null;
  error_message: string | null;
  requested_by: string | null;
  requested_at: string;
  completed_at: string | null;
  updated_at: string;
}

export interface FileRow {
  id: string;
  name: string;
  category: string;
  description: string | null;
  blob_url: string | null;
  content_type: string | null;
  size_bytes: number | null;
  text_content?: string | null;
  text_length?: number;
  source: "upload" | "claude_code";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScriptRow {
  id: string;
  video_id: string | null;
  title: string;
  full_script: string;
  hook: string;
  structure: string;
  status: "draft" | "ready" | "published" | "archived";
  source: "manual" | "claude_code";
  created_by: string | null;
  created_at: string;
  updated_at: string;
  latest_analysis_summary?: string | null;
}

export interface MetaInsightRow {
  id: string;
  metric: string;
  period: string;
  value: number | null;
  captured_at: string;
}
