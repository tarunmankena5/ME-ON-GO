import { CalendarScreen } from "@/components/calendar/calendar-screen";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const query = await searchParams;
  const date = Array.isArray(query.date) ? query.date[0] : query.date;
  return <CalendarScreen initialDate={date} />;
}
