import { EntryDetailsScreen } from "@/components/entries/entry-details-screen";
import { isValidDateKey } from "@/lib/dates/calendar";

export default async function EntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; date?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const returnHref = query.from === "upcoming"
    ? "/#upcoming-heading"
    : query.from === "calendar" && query.date && isValidDateKey(query.date)
      ? `/calendar/day?date=${query.date}`
      : query.from === "calendar"
        ? "/calendar"
        : "/#today-heading";

  return <EntryDetailsScreen id={id} returnHref={returnHref} />;
}
