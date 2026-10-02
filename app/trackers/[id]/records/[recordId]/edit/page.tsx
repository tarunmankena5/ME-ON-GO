import { TrackerRecordForm } from "@/components/trackers/tracker-record-form";

export default async function EditTrackerRecordPage({ params }: { params: Promise<{ id: string; recordId: string }> }) {
  const { id, recordId } = await params;
  return <TrackerRecordForm trackerId={id} recordId={recordId} />;
}
