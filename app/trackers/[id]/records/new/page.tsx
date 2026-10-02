import { TrackerRecordForm } from "@/components/trackers/tracker-record-form";

export default async function NewTrackerRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TrackerRecordForm trackerId={id} />;
}
