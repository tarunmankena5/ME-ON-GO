"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EntryTimeline } from "@/components/entries/entry-timeline";
import { UpcomingEntry } from "@/components/entries/upcoming-entry";
import { UpcomingRecurringEntry } from "@/components/entries/upcoming-recurring-entry";
import { createEntryRepository } from "@/lib/data/create-entry-repository";
import { createRecurringEntryRepository } from "@/lib/data/create-recurring-entry-repository";
import { isTaskOverdue, sortTasks } from "@/lib/dates/task-state";
import {
  addDaysToDateKey,
  formatDateKey,
  getDateKeyInTimeZone,
  getDeviceTimeZone,
} from "@/lib/dates/time-zone";
import type { Entry, TaskEntry } from "@/types/entry";
import { getRecurringOccurrence, type RecurringOccurrence } from "@/types/recurring-entry";

type ScreenState =
  | { status: "loading"; dateKey: string | null; timeZone: string | null }
  | { status: "error"; dateKey: string; timeZone: string; message: string }
  | {
      status: "ready";
      dateKey: string;
      timeZone: string;
      entries: Entry[];
      overdueTasks: TaskEntry[];
      upcoming: Entry[];
      recurringToday: RecurringOccurrence[];
      recurringUpcoming: RecurringOccurrence[];
    };

function getEntryTimestamp(entry: Entry): string | null {
  switch (entry.kind) {
    case "ACTIVITY":
      return entry.occurredAt;
    case "TASK":
      return entry.dueAt;
    case "EVENT":
      return entry.startsAt;
  }
}

function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((left, right) =>
    (getEntryTimestamp(left) ?? "").localeCompare(getEntryTimestamp(right) ?? ""),
  );
}

type UpcomingItem = Entry | RecurringOccurrence;
type UpcomingGroup = { date: string | null; items: UpcomingItem[] };

function groupUpcoming(entries: Entry[], recurring: RecurringOccurrence[], timeZone: string): UpcomingGroup[] {
  const groups = new Map<string, UpcomingItem[]>();
  for (const entry of entries) {
    const timestamp = getEntryTimestamp(entry);
    const key = timestamp ? getDateKeyInTimeZone(new Date(timestamp), timeZone) : "SOMEDAY";
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  for (const entry of recurring) groups.set(entry.occurrenceDate, [...(groups.get(entry.occurrenceDate) ?? []), entry]);
  return [...groups.entries()].map(([key, items]) => ({
    date: key === "SOMEDAY" ? null : key,
    items: items.sort((a, b) => {
      const aDate = "occurrenceDate" in a ? `${a.occurrenceDate}T00:00:00.000Z` : getEntryTimestamp(a) ?? a.createdAt;
      const bDate = "occurrenceDate" in b ? `${b.occurrenceDate}T00:00:00.000Z` : getEntryTimestamp(b) ?? b.createdAt;
      return aDate.localeCompare(bDate);
    }),
  })).sort((a, b) => {
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return a.date.localeCompare(b.date);
  });
}

function SectionHeading({ id, label }: { id: string; label: string }) {
  return <div className="flex items-center gap-4"><h2 id={id} className="text-[11px] font-medium uppercase tracking-[0.24em] text-stone-500">{label}</h2><span aria-hidden="true" className="h-px flex-1 bg-white/[0.06]" /></div>;
}

function DateHeading({ dateKey }: { dateKey: string | null }) {
  if (dateKey === null) {
    return (
      <div aria-hidden="true" className="space-y-3">
        <div className="h-3 w-36 animate-pulse rounded-sm bg-white/[0.07]" />
        <div className="h-9 w-32 animate-pulse rounded-sm bg-white/[0.07]" />
      </div>
    );
  }

  const day = Number(dateKey.slice(-2));

  return (
    <>
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-amber-100/70">
        {formatDateKey(dateKey, { month: "long" })} {day}
      </p>
      <p className="mt-2 text-xl font-normal tracking-[-0.025em] text-stone-300 sm:text-2xl">
        {formatDateKey(dateKey, { weekday: "long" })}
      </p>
    </>
  );
}

function LoadingState() {
  return (
    <div role="status" aria-live="polite" className="mt-7 space-y-4">
      <span className="sr-only">Loading today’s entries</span>
      <div className="h-5 w-52 animate-pulse rounded-sm bg-white/[0.06]" />
      <div className="h-14 w-72 max-w-full animate-pulse border-y border-white/[0.05] bg-white/[0.02]" />
    </div>
  );
}

export function TodayScreen() {
  const repository = useMemo(() => createEntryRepository(), []);
  const recurringRepository = useMemo(() => createRecurringEntryRepository(), []);
  const [screen, setScreen] = useState<ScreenState>({
    status: "loading",
    dateKey: null,
    timeZone: null,
  });

  const loadDay = useCallback(async (showLoading = true) => {
    const timeZone = getDeviceTimeZone();
    const dateKey = getDateKeyInTimeZone(new Date(), timeZone);
    if (showLoading) setScreen({ status: "loading", dateKey, timeZone });

    try {
      const [overview, recurringEntries] = await Promise.all([
        repository.listTodayOverview(dateKey, new Date().toISOString(), timeZone),
        recurringRepository.listAll(),
      ]);
      const currentYear = Number(dateKey.slice(0, 4));
      const recurringOccurrences = recurringEntries.flatMap((item) => [
        getRecurringOccurrence(item, currentYear),
        getRecurringOccurrence(item, currentYear + 1),
      ]).sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));
      setScreen({
        status: "ready", dateKey, timeZone, entries: overview.today, overdueTasks: overview.overdueTasks, upcoming: overview.upcoming,
        recurringToday: recurringOccurrences.filter((item) => item.occurrenceDate === dateKey),
        recurringUpcoming: recurringOccurrences.filter((item) => item.occurrenceDate > dateKey && item.occurrenceDate <= addDaysToDateKey(dateKey, 90)),
      });
    } catch {
      setScreen({
        status: "error",
        dateKey,
        timeZone,
        message: "Today’s entries couldn’t be loaded. Please try again.",
      });
    }
  }, [recurringRepository, repository]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDay(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDay]);

  useEffect(() => {
    const nextMidnight = new Date();
    nextMidnight.setHours(24, 0, 0, 25);
    const timer = window.setTimeout(() => void loadDay(), nextMidnight.getTime() - Date.now());
    return () => window.clearTimeout(timer);
  }, [loadDay, screen.dateKey]);

  const onToggleTask = useCallback(async (task: TaskEntry) => {
    try {
      const updated = await repository.update(task.id, {
        completedAt: task.completedAt === null ? new Date().toISOString() : null,
      });
      setScreen((current) => {
        if (current.status !== "ready") return current;
        const entries = current.entries.map((entry) => (entry.id === updated.id ? updated : entry));
        let overdueTasks = current.overdueTasks.filter((entry) => entry.id !== updated.id);
        let upcoming = current.upcoming.filter((entry) => entry.id !== updated.id);

        if (updated.kind === "TASK" && updated.completedAt === null) {
          const now = new Date();
          const dueDate = updated.dueAt ? getDateKeyInTimeZone(new Date(updated.dueAt), current.timeZone) : null;
          if (dueDate === null || dueDate >= addDaysToDateKey(current.dateKey, 1)) upcoming = sortEntries([...upcoming, updated]);
          if (isTaskOverdue(updated, now, current.timeZone)) overdueTasks = sortTasks([...overdueTasks, updated], current.timeZone, now);
        }

        return { ...current, entries, overdueTasks, upcoming };
      });
    } catch {
      setScreen((current) => ({
        status: "error",
        dateKey: current.dateKey ?? getDateKeyInTimeZone(new Date(), getDeviceTimeZone()),
        timeZone: current.timeZone ?? getDeviceTimeZone(),
        message: "That task couldn’t be updated. Please try again.",
      }));
    }
  }, [repository]);

  const month = screen.dateKey
    ? formatDateKey(screen.dateKey, { month: "long" }).toUpperCase()
    : null;
  const tomorrow = screen.dateKey ? addDaysToDateKey(screen.dateKey, 1) : null;
  const ready = screen.status === "ready" ? screen : null;
  const overdueIds = new Set(ready?.overdueTasks.map((task) => task.id) ?? []);
  const overdueTasks = ready ? sortTasks(ready.overdueTasks, ready.timeZone) : [];
  const todayTasks = ready ? sortTasks(ready.entries.filter((entry): entry is TaskEntry => entry.kind === "TASK" && !overdueIds.has(entry.id)), ready.timeZone) : [];
  const todayEvents = ready ? ready.entries.filter((entry) => entry.kind === "EVENT").sort((a, b) => getEntryTimestamp(a)!.localeCompare(getEntryTimestamp(b)!)) : [];
  const todayActivities = ready ? ready.entries.filter((entry) => entry.kind === "ACTIVITY").sort((a, b) => getEntryTimestamp(a)!.localeCompare(getEntryTimestamp(b)!)) : [];
  const upcomingGroups = ready ? groupUpcoming(ready.upcoming, ready.recurringUpcoming, ready.timeZone) : [];
  const hasTodayItems = Boolean(ready && (ready.entries.length || ready.overdueTasks.length || ready.recurringToday.length));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 pb-[max(8rem,calc(env(safe-area-inset-bottom)+7rem))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-10">
      <header className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <Link
          href="/"
          aria-label="ME ON GO Today"
          className="inline-flex min-h-11 items-center text-xs font-medium tracking-[0.2em] text-stone-200 transition-colors hover:text-amber-100"
        >
          ME ON GO
        </Link>
        <span className="text-[10px] uppercase tracking-[0.2em] text-stone-600">Today</span>
      </header>

      <section aria-label="Current date" className="pb-12 pt-12 sm:pb-16 sm:pt-16">
        {month ? (
          <p className="text-4xl font-medium tracking-[-0.055em] text-stone-100 sm:text-5xl">
            {month} {Number(screen.dateKey?.slice(-2))}
          </p>
        ) : (
          <DateHeading dateKey={null} />
        )}
        {screen.dateKey && (
          <p className="mt-2 text-lg font-normal tracking-[-0.025em] text-stone-400 sm:text-xl">
            {formatDateKey(screen.dateKey, { weekday: "long" })}
          </p>
        )}
      </section>

      <section aria-labelledby="today-heading" className="flex-1">
        <div className="flex items-center gap-4">
          <h1 id="today-heading" className="text-[11px] font-medium uppercase tracking-[0.24em] text-stone-400">
            Today
          </h1>
          <span aria-hidden="true" className="h-px flex-1 bg-white/[0.07]" />
        </div>

        {screen.status === "loading" && <LoadingState />}

        {screen.status === "error" && (
          <div role="alert" className="mt-7 max-w-md">
            <p className="text-base leading-6 text-stone-300">{screen.message}</p>
            <button
              type="button"
              onClick={() => void loadDay()}
              className="mt-4 inline-flex min-h-11 items-center border-b border-amber-100/30 text-sm text-amber-100/80 transition-colors hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
            >
              Try again
            </button>
          </div>
        )}

        {screen.status === "ready" && (
          <div className="pt-7">
            {!hasTodayItems ? (
              <p className="text-lg tracking-[-0.02em] text-stone-300 sm:text-xl">
                Your day is still open.
              </p>
            ) : (
              <div className="space-y-9">
                {overdueTasks.length > 0 && <section aria-labelledby="overdue-heading"><SectionHeading id="overdue-heading" label="Overdue" /><EntryTimeline entries={overdueTasks} timeZone={screen.timeZone} onToggleTask={onToggleTask} label="Overdue tasks" /></section>}
                {todayTasks.length > 0 && <section aria-labelledby="today-tasks-heading"><SectionHeading id="today-tasks-heading" label="Tasks" /><EntryTimeline entries={todayTasks} timeZone={screen.timeZone} onToggleTask={onToggleTask} label="Today’s tasks" /></section>}
                {todayEvents.length > 0 && <section aria-labelledby="today-events-heading"><SectionHeading id="today-events-heading" label="Events" /><EntryTimeline entries={todayEvents} timeZone={screen.timeZone} onToggleTask={onToggleTask} label="Today’s events" /></section>}
                {screen.recurringToday.length > 0 && <section aria-labelledby="life-dates-heading"><SectionHeading id="life-dates-heading" label="Life dates" /><EntryTimeline entries={screen.recurringToday} timeZone={screen.timeZone} onToggleTask={onToggleTask} label="Today’s birthdays and anniversaries" /></section>}
                {todayActivities.length > 0 && <section aria-labelledby="today-activities-heading"><SectionHeading id="today-activities-heading" label="Activity" /><EntryTimeline entries={todayActivities} timeZone={screen.timeZone} onToggleTask={onToggleTask} label="Today’s activities" /></section>}
              </div>
            )}

            <Link
              href="/add"
              className="group mt-7 inline-flex min-h-[4.5rem] items-center gap-4 border-y border-white/[0.12] pr-5 text-stone-200 transition-colors hover:border-amber-100/30 hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-100/30 text-2xl font-light leading-none text-amber-100 transition-colors group-hover:border-amber-100/60 group-hover:bg-amber-100/[0.06]">
                <span aria-hidden="true">+</span>
              </span>
              <span className="text-sm font-medium">Add something</span>
              <span aria-hidden="true" className="ml-1 text-stone-600 transition-transform group-hover:translate-x-1 group-hover:text-amber-100/70">
                →
              </span>
            </Link>
          </div>
        )}

      </section>

      {screen.status === "ready" && tomorrow && (
        <section aria-labelledby="upcoming-heading" className="mt-14 border-t border-white/[0.08] pt-6 sm:mt-20">
          <div className="flex items-center justify-between gap-4">
            <h2 id="upcoming-heading" className="text-[11px] font-medium uppercase tracking-[0.24em] text-stone-500">
              Upcoming
            </h2>
            <span aria-hidden="true" className="h-px flex-1 bg-white/[0.06]" />
          </div>

          {upcomingGroups.length > 0 ? (
            <div className="mt-5 space-y-7">
              {upcomingGroups.map((group) => {
                const tasks = group.items.filter((item) => !("occurrenceDate" in item) && item.kind === "TASK").length;
                const events = group.items.filter((item) => !("occurrenceDate" in item) && item.kind === "EVENT").length;
                const lifeDates = group.items.filter((item) => "occurrenceDate" in item).length;
                const label = group.date === null ? "Someday" : group.date === screen.dateKey ? "Today" : group.date === tomorrow ? "Tomorrow" : formatDateKey(group.date, { month: "short", day: "numeric" });
                const counts = [tasks > 0 ? `${tasks} ${tasks === 1 ? "task" : "tasks"}` : "", events > 0 ? `${events} ${events === 1 ? "event" : "events"}` : "", lifeDates > 0 ? `${lifeDates} ${lifeDates === 1 ? "life date" : "life dates"}` : ""].filter(Boolean).join(" · ");
                return <section key={group.date ?? "someday"} aria-label={`${label}${counts ? `, ${counts}` : ""}`}>
                  <div className="mb-1 flex items-baseline justify-between gap-3"><h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone-500">{label}</h3><p className="text-[10px] text-stone-700">{counts}</p></div>
                  <ul>{group.items.map((entry) => "occurrenceDate" in entry ? <UpcomingRecurringEntry key={`recurring-${entry.id}`} entry={entry} /> : <UpcomingEntry key={entry.id} entry={entry} tomorrow={tomorrow} timeZone={screen.timeZone} onToggleTask={onToggleTask} />)}</ul>
                </section>;
              })}
            </div>
          ) : (
            <p className="mt-5 text-sm text-stone-700">Nothing else planned.</p>
          )}
        </section>
      )}
    </main>
  );
}
