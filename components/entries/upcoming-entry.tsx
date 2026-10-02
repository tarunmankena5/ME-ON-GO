import Link from "next/link";
import type { Entry, TaskEntry } from "@/types/entry";
import { formatDateKey, getDateKeyInTimeZone, isDateOnlyTimestamp } from "@/lib/dates/time-zone";

type UpcomingEntryProps = {
  entry: Entry;
  tomorrow: string;
  timeZone: string;
  onToggleTask: (task: TaskEntry) => void;
};

export function UpcomingEntry({ entry, tomorrow, timeZone, onToggleTask }: UpcomingEntryProps) {
  const timestamp = entry.kind === "TASK" ? entry.dueAt : entry.kind === "EVENT" ? entry.startsAt : null;
  const date = timestamp === null ? null : getDateKeyInTimeZone(new Date(timestamp), timeZone);
  const dateLabel = date === null
    ? ""
    : date === tomorrow
      ? "Tomorrow"
      : formatDateKey(date, { month: "short", day: "numeric" });
  const time = entry.kind === "TASK"
    ? entry.dueAt && !isDateOnlyTimestamp(entry.dueAt, timeZone) ? entry.dueAt : null
    : entry.kind === "EVENT" ? entry.startsAt : null;

  return (
    <li className="group flex items-center justify-between gap-4 py-2">
      <Link href={`/entries/${entry.id}?from=upcoming`} className="flex min-w-0 flex-1 flex-col justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">
        <p className="truncate text-base font-medium text-stone-200">{entry.title}</p>
        <p className={`mt-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] ${entry.kind === "TASK" && entry.priority === "HIGH" ? "text-amber-100/80" : "text-stone-500"}`}>
          {entry.kind === "TASK" ? (
            <>
              {entry.priority !== "NORMAL" ? <span>{entry.priority}</span> : null}
              {entry.priority !== "NORMAL" && time ? <span aria-hidden="true" className="text-stone-700">·</span> : null}
              {time ? (
                <time dateTime={time} className="font-mono tabular-nums">
                  {new Intl.DateTimeFormat("en", {
                    timeZone,
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(time))}
                </time>
              ) : null}
              {!time && entry.priority === "NORMAL" ? <span>Task</span> : null}
            </>
          ) : (
            <>
              <span>Event</span>
              {time ? <span aria-hidden="true" className="text-stone-700">·</span> : null}
              {time ? (
                <time dateTime={time} className="font-mono tabular-nums">
                  {new Intl.DateTimeFormat("en", {
                    timeZone,
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(time))}
                </time>
              ) : null}
            </>
          )}
        </p>
      </Link>

      {entry.kind === "TASK" ? (
        <button
          type="button"
          aria-label={`Mark ${entry.title} complete`}
          onClick={() => onToggleTask(entry)}
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-600 transition-colors hover:border-amber-100/60 hover:text-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 active:bg-white/5"
        >
          <span aria-hidden="true" className="h-5 w-5 rounded-full border border-stone-600 group-hover:border-amber-100/60" />
        </button>
      ) : null}
    </li>
  );
}
