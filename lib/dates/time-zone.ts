export function getDeviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function getDateKeyInTimeZone(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const fields = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match || !Number.isInteger(days)) {
    throw new Error("A valid date and whole number of days are required.");
  }

  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days);
  if (Number.isNaN(date.valueOf())) throw new Error("The date is invalid.");
  return date.toISOString().slice(0, 10);
}

export function formatDateKey(
  dateKey: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" }).format(date);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function formatInTimeZone(
  value: string | Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en", { ...options, timeZone }).format(new Date(value));
}

/** Date-only task deadlines use local midnight as their timestamp sentinel. */
export function isDateOnlyTimestamp(value: string, timeZone: string): boolean {
  return formatInTimeZone(value, timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }) === "00:00";
}
