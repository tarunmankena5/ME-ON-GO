import Link from "next/link";
import { formatDateKey } from "@/lib/dates/time-zone";
import type { RecurringOccurrence } from "@/types/recurring-entry";

export function UpcomingRecurringEntry({ entry }: { entry: RecurringOccurrence }) {
  return <li className="group flex items-center justify-between gap-4 py-2">
    <Link href={`/recurring/${entry.id}`} className="flex min-w-0 flex-1 flex-col justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">
      <p className="truncate text-base font-medium text-stone-200">{entry.title}</p>
      <p className="mt-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-violet-200/50">
        <span>{entry.kind === "BIRTHDAY" ? "Birthday" : "Anniversary"}</span>
        {entry.yearsSince !== null ? <><span aria-hidden="true" className="text-stone-700">·</span><span>{entry.yearsSince} years</span></> : null}
      </p>
    </Link>
  </li>;
}
