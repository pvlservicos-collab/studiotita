import CompetitorDetail from "@/components/CompetitorDetail";

export default function ConcorrentePage({ params }: { params: { id: string } }) {
  return <CompetitorDetail id={params.id} />;
}
