import { addDaysToDateKey } from "@/lib/dates/time-zone";

export type CalendarMonth = {
  key: string;
  startDate: string;
  endDate: string;
  days: (string | null)[];
};

function utcDate(year: number, monthIndex: number, day: number): Date {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, monthIndex, day);
  return date;
}

export function isValidDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function getCalendarMonth(monthKey: string): CalendarMonth {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) throw new Error("A valid month is required.");
  const [year, month] = monthKey.split("-").map(Number);
  if (month < 1 || month > 12) throw new Error("A valid month is required.");
  const startDate = `${monthKey}-01`;
  const nextMonthDate = new Date(`${startDate}T00:00:00.000Z`);
  nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1);
  const endDate = nextMonthDate.toISOString().slice(0, 10);
  const daysInMonth = utcDate(year, month, 0).getUTCDate();
  const weekdayOffset = new Date(`${startDate}T00:00:00.000Z`).getUTCDay();
  const cellCount = Math.ceil((weekdayOffset + daysInMonth) / 7) * 7;
  const days = Array.from({ length: cellCount }, (_, index) => {
    const day = index - weekdayOffset + 1;
    return day < 1 || day > daysInMonth ? null : addDaysToDateKey(startDate, day - 1);
  });
  return { key: monthKey, startDate, endDate, days };
}

export function monthKeyForDate(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function shiftMonth(monthKey: string, offset: number): string {
  const date = new Date(`${monthKey}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function dateInMonth(monthKey: string, preferredDay: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = utcDate(year, month, 0).getUTCDate();
  const day = Math.min(Math.max(preferredDay, 1), daysInMonth);
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}
