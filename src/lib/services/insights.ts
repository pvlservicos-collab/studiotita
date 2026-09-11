import { query } from "@/lib/db";
import type { MetaInsightRow } from "@/lib/types";
import { fetchAccountInsights, fetchAccountSummary } from "@/lib/meta";

export async function syncAccountInsights() {
  const [insights, summary] = await Promise.all([
    fetchAccountInsights(),
    fetchAccountSummary(),
  ]);

  const rows: { metric: string; period: string; value: number; raw: unknown }[] = [];

  for (const item of insights) {
    rows.push({ metric: item.name, period: item.period, value: item.value, raw: item });
  }

  rows.push({ metric: "followers_count", period: "lifetime", value: summary.followers_count, raw: summary });
  rows.push({ metric: "follows_count", period: "lifetime", value: summary.follows_count, raw: summary });
  rows.push({ metric: "media_count", period: "lifetime", value: summary.media_count, raw: summary });

  for (const row of rows) {
    await query(
      `insert into meta_insights (metric, period, value, raw) values ($1,$2,$3,$4)`,
      [row.metric, row.period, row.value, JSON.stringify(row.raw)]
    );
  }

  return { summary, storedMetrics: rows.length };
}

export async function getLatestInsights(): Promise<MetaInsightRow[]> {
  return query<MetaInsightRow>(
    `select distinct on (metric) *
     from meta_insights
     order by metric, captured_at desc`
  );
}
