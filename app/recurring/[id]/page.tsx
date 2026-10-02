import { RecurringEntryDetailsScreen } from "@/components/entries/recurring-entry-details-screen";

export default async function RecurringEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecurringEntryDetailsScreen id={id} />;
}
