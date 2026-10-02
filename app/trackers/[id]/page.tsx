import { TrackerDetail } from "@/components/trackers/tracker-detail";

export default async function TrackerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TrackerDetail trackerId={id} />;
}
