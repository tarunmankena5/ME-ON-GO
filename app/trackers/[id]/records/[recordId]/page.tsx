import { TrackerRecordDetail } from "@/components/trackers/tracker-record-detail";

export default async function TrackerRecordPage({ params }: { params: Promise<{ id: string; recordId: string }> }) {
  const { id, recordId } = await params;
  return <TrackerRecordDetail trackerId={id} recordId={recordId} />;
}
