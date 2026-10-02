"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EntryTimeline } from "@/components/entries/entry-timeline";
import { createEntryRepository } from "@/lib/data/create-entry-repository";
import { createRecurringEntryRepository } from "@/lib/data/create-recurring-entry-repository";
import { isValidDateKey } from "@/lib/dates/calendar";
import { formatDateKey, getDeviceTimeZone } from "@/lib/dates/time-zone";
import type { Entry, TaskEntry } from "@/types/entry";
import { getRecurringOccurrence, type RecurringOccurrence } from "@/types/recurring-entry";

type DayItem = Entry | RecurringOccurrence;

type DayState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; entries: DayItem[]; timeZone: string };

export function CalendarDayScreen({ dateKey }: { dateKey: string }) {
  const repository = useMemo(() => createEntryRepository(), []);
  const recurringRepository = useMemo(() => createRecurringEntryRepository(), []);
  const [screen, setScreen] = useState<DayState>({ status: "loading" });
  const validDate = isValidDateKey(dateKey);

  const load = useCallback(async () => {
    if (!validDate) return;
    const timeZone = getDeviceTimeZone();
    setScreen({ status: "loading" });
    try {
      const [entries, recurring] = await Promise.all([repository.listForDate(dateKey, timeZone), recurringRepository.listAll()]);
      const year = Number(dateKey.slice(0, 4));
      const occurrences = recurring.map((entry) => getRecurringOccurrence(entry, year)).filter((entry) => entry.occurrenceDate === dateKey);
      setScreen({ status: "ready", entries: [...entries, ...occurrences], timeZone });
    } catch {
      setScreen({ status: "error", message: "This day’s entries couldn’t be loaded. Please try again." });
    }
  }, [dateKey, recurringRepository, repository, validDate]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const toggleTask = useCallback(async (task: TaskEntry) => {
    try {
      const updated = await repository.update(task.id, { completedAt: task.completedAt === null ? new Date().toISOString() : null });
      setScreen((current) => current.status === "ready"
        ? { ...current, entries: current.entries.map((entry) => !("occurrenceDate" in entry) && entry.id === updated.id ? updated : entry) }
        : current);
    } catch {
      setScreen({ status: "error", message: "That task couldn’t be updated. Please try again." });
    }
  }, [repository]);

  const formattedDate = validDate
    ? formatDateKey(dateKey, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "Invalid date";

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-6 pb-32 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-10">
      <header className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <Link href="/" aria-label="ME ON GO Today" className="inline-flex min-h-11 items-center text-xs font-medium tracking-[0.2em] text-stone-200 transition-colors hover:text-amber-100">ME ON GO</Link>
        <span className="text-[10px] uppercase tracking-[0.2em] text-stone-600">Day</span>
      </header>
      <div className="mt-6">
        <Link href={`/calendar?date=${dateKey}`} className="inline-flex min-h-11 items-center gap-2 text-xs uppercase tracking-[0.16em] text-stone-500 transition-colors hover:text-amber-100 focus-visible:outline-2 focus-visible:outline-amber-200"><span aria-hidden="true">‹</span> Calendar</Link>
      </div>
      <section className="pb-8 pt-5 sm:pb-10">
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-stone-500">Day view</p>
        <h1 className="mt-3 text-3xl font-medium tracking-[-0.05em] text-stone-100 sm:text-4xl">{formattedDate}</h1>
      </section>

      {!validDate && <p role="alert" className="border-t border-white/[0.08] py-6 text-sm text-stone-400">That calendar date is invalid.</p>}
      {validDate && screen.status === "loading" && <p role="status" className="border-t border-white/[0.08] py-6 text-sm text-stone-600">Loading this day…</p>}
      {validDate && screen.status === "error" && (
        <div role="alert" className="border-t border-white/[0.08] py-6">
          <p className="text-sm text-stone-400">{screen.message}</p>
          <button type="button" onClick={() => void load()} className="mt-3 min-h-11 border-b border-amber-100/30 text-sm text-amber-100/80 focus-visible:outline-2 focus-visible:outline-amber-200">Try again</button>
        </div>
      )}
      {validDate && screen.status === "ready" && (
        screen.entries.length > 0 ? (
          <EntryTimeline
            entries={screen.entries}
            timeZone={screen.timeZone}
            onToggleTask={toggleTask}
            label={`${formattedDate} timeline`}
            returnHref={(entry) => `/entries/${entry.id}?from=calendar&date=${dateKey}`}
          />
        ) : (
          <div className="border-t border-white/[0.08] py-6">
            <p className="text-sm text-stone-500">Nothing recorded.</p>
            <Link href="/add" className="mt-4 inline-flex min-h-11 items-center gap-3 text-sm text-amber-100/80 hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-amber-200"><span aria-hidden="true" className="text-xl font-light">+</span>Add something</Link>
          </div>
        )
      )}
    </main>
  );
}
