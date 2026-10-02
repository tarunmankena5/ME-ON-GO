import { CalendarDayScreen } from "@/components/calendar/calendar-day-screen";

export default async function CalendarDayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const query = await searchParams;
  const date = Array.isArray(query.date) ? query.date[0] ?? "" : query.date ?? "";
  return <CalendarDayScreen dateKey={date} />;
}
