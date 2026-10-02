import { TrackerBuilder } from "@/components/trackers/tracker-builder";

export default async function EditTrackerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TrackerBuilder trackerId={id} />;
}
