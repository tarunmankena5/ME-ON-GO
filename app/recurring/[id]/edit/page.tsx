import { RecurringEntryForm } from "@/components/entries/recurring-entry-form";

export default async function EditRecurringEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecurringEntryForm entryId={id} />;
}
