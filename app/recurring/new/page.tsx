import { RecurringEntryForm } from "@/components/entries/recurring-entry-form";

export default async function NewRecurringEntryPage({ searchParams }: { searchParams: Promise<{ kind?: string | string[] }> }) {
  const query = await searchParams;
  const value = Array.isArray(query.kind) ? query.kind[0] : query.kind;
  const kind = value === "ANNIVERSARY" ? "ANNIVERSARY" : "BIRTHDAY";
  return <RecurringEntryForm kind={kind} />;
}
