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
  created_at: string;
  updated_at: string;
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
  patterns: string | null;
  error_message: string | null;
  requested_by: string | null;
  requested_at: string;
  completed_at: string | null;
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
