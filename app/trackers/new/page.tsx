import { TrackerBuilder } from "@/components/trackers/tracker-builder";

export default async function NewTrackerPage({ searchParams }: { searchParams: Promise<{ template?: string | string[] }> }) {
  const query = await searchParams;
  const template = Array.isArray(query.template) ? query.template[0] : query.template;
  return <TrackerBuilder templateId={template} />;
}
