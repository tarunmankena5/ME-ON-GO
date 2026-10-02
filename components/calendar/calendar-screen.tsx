"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createEntryRepository } from "@/lib/data/create-entry-repository";
import { createRecurringEntryRepository } from "@/lib/data/create-recurring-entry-repository";
import type { Entry, EntryKind, TaskEntry } from "@/types/entry";
import { getRecurringOccurrence, type RecurringOccurrence } from "@/types/recurring-entry";
import { isTaskOverdue } from "@/lib/dates/task-state";
import {
  dateInMonth,
  getCalendarMonth,
  isValidDateKey,
  monthKeyForDate,
  shiftMonth,
} from "@/lib/dates/calendar";
import {
  addDaysToDateKey,
  formatDateKey,
  formatInTimeZone,
  getDateKeyInTimeZone,
  getDeviceTimeZone,
  isDateOnlyTimestamp,
} from "@/lib/dates/time-zone";

type MonthState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; entries: Entry[]; occurrences: RecurringOccurrence[] };

const weekdayNames = ["S", "M", "T", "W", "T", "F", "S"];

type CalendarItem = Entry | RecurringOccurrence;

function entryDate(entry: CalendarItem): string {
  if ("occurrenceDate" in entry) return entry.occurrenceDate;
  switch (entry.kind) {
    case "ACTIVITY": return entry.occurredAt;
    case "TASK": return entry.dueAt ?? entry.createdAt;
    case "EVENT": return entry.startsAt;
  }
}

function getTime(entry: CalendarItem, timeZone: string): string | null {
  if ("occurrenceDate" in entry) return null;
  if (entry.kind === "TASK") {
    return entry.dueAt && !isDateOnlyTimestamp(entry.dueAt, timeZone) ? entry.dueAt : null;
  }
  return entry.kind === "ACTIVITY" ? entry.occurredAt : entry.startsAt;
}

function getEntryDay(entry: CalendarItem, timeZone: string): string | null {
  if ("occurrenceDate" in entry) return entry.occurrenceDate;
  if (entry.kind === "TASK" && entry.dueAt === null) return null;
  return getDateKeyInTimeZone(new Date(entryDate(entry)), timeZone);
}

function entryKindLabel(kind: EntryKind): string {
  return kind === "ACTIVITY" ? "Activities" : kind === "TASK" ? "Tasks" : "Events";
}

type DaySummary = {
  pendingTasks: TaskEntry[];
  completedTasks: TaskEntry[];
  overdueTasks: TaskEntry[];
  events: Entry[];
  activities: Entry[];
  birthdays: RecurringOccurrence[];
  anniversaries: RecurringOccurrence[];
}

function summarizeDay(entries: CalendarItem[], timeZone: string): DaySummary {
  const summary: DaySummary = { pendingTasks: [], completedTasks: [], overdueTasks: [], events: [], activities: [], birthdays: [], anniversaries: [] };
  for (const entry of entries) {
    if ("occurrenceDate" in entry) {
      if (entry.kind === "BIRTHDAY") summary.birthdays.push(entry);
      else summary.anniversaries.push(entry);
    } else if (entry.kind === "TASK") {
      if (entry.completedAt !== null) summary.completedTasks.push(entry);
      else {
        summary.pendingTasks.push(entry);
        if (isTaskOverdue(entry, new Date(), timeZone)) summary.overdueTasks.push(entry);
      }
    } else if (entry.kind === "EVENT") summary.events.push(entry);
    else summary.activities.push(entry);
  }
  return summary;
}

function accessibleDateSummary(date: string, summary: DaySummary): string {
  const parts = [
    summary.pendingTasks.length > 0 && `${summary.pendingTasks.length} pending ${summary.pendingTasks.length === 1 ? "task" : "tasks"}`,
    summary.overdueTasks.length > 0 && `${summary.overdueTasks.length} overdue ${summary.overdueTasks.length === 1 ? "task" : "tasks"}`,
    summary.completedTasks.length > 0 && `${summary.completedTasks.length} completed ${summary.completedTasks.length === 1 ? "task" : "tasks"}`,
    summary.events.length > 0 && `${summary.events.length} ${summary.events.length === 1 ? "event" : "events"}`,
    summary.activities.length > 0 && `${summary.activities.length} ${summary.activities.length === 1 ? "activity" : "activities"}`,
    summary.birthdays.length > 0 && `${summary.birthdays.length} ${summary.birthdays.length === 1 ? "birthday" : "birthdays"}`,
    summary.anniversaries.length > 0 && `${summary.anniversaries.length} ${summary.anniversaries.length === 1 ? "anniversary" : "anniversaries"}`,
  ].filter(Boolean);
  return `${formatDateKey(date, { month: "long", day: "numeric", year: "numeric" })}, ${parts.length === 0 ? "no entries" : parts.join(", ")}`;
}

function EntryIndicators({
  entries,
  summary,
}: {
  entries: CalendarItem[];
  summary: DaySummary;
}) {
  const markers = [
    summary.overdueTasks.length > 0 && { key: "overdue", color: "bg-red-300/75" },
    summary.pendingTasks.length > summary.overdueTasks.length && { key: "pending", color: "bg-amber-200/75" },
    summary.events.length > 0 && { key: "events", color: "bg-indigo-300/70" },
    summary.activities.length > 0 && { key: "activities", color: "bg-emerald-200/65" },
    summary.completedTasks.length > 0 && { key: "completed", color: "bg-stone-600/80" },
    (summary.birthdays.length > 0 || summary.anniversaries.length > 0) && { key: "recurring", color: "bg-violet-200/75" },
  ].filter((marker): marker is { key: string; color: string } => marker !== false);
  const dotSize = entries.length >= 4 ? "h-1.5 w-1.5" : entries.length >= 2 ? "h-1 w-1.5" : "h-1 w-1";
  const dotGap = entries.length >= 4 ? "gap-1" : "gap-[3px]";
  const pendingCountText = summary.pendingTasks.length >= 2
    ? `${summary.pendingTasks.length} tasks`
    : "";

  return (
    <>
      <span aria-hidden="true" className={`mt-1 flex h-1.5 items-center justify-center ${dotGap}`}>
        {markers.map((marker, index) => (
          <span key={`${marker.key}-${index}`} className={`${dotSize} rounded-full ${marker.color}`} />
        ))}
        {entries.length > 4 && <span className="ml-0.5 h-1 w-1 rounded-full bg-stone-500" />}
      </span>
      {(pendingCountText || summary.overdueTasks.length > 0) && (
        <span aria-hidden="true" className="mt-0.5 flex items-center justify-center gap-1 text-[8px] leading-3 tracking-tight">
          {pendingCountText && <span className="text-amber-100/55">{pendingCountText}</span>}
          {summary.overdueTasks.length > 0 && <span className="text-red-200/65">{summary.overdueTasks.length} late</span>}
        </span>
      )}
    </>
  );
}

function shortTime(entry: CalendarItem, timeZone: string): string | null {
  const time = getTime(entry, timeZone);
  return time ? formatInTimeZone(time, timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : null;
}

function MonthLoading() {
  return (
    <div role="status" aria-live="polite" className="mt-8 space-y-6">
      <span className="sr-only">Loading calendar entries</span>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-sm bg-white/[0.025]" />)}
      </div>
    </div>
  );
}

export function CalendarScreen({ initialDate }: { initialDate?: string }) {
  const repository = useMemo(() => createEntryRepository(), []);
  const recurringRepository = useMemo(() => createRecurringEntryRepository(), []);
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [monthState, setMonthState] = useState<MonthState>({ status: "loading" });
  const keyboardFocusDate = useRef<string | null>(null);

  useEffect(() => {
    const zone = getDeviceTimeZone();
    const current = getDateKeyInTimeZone(new Date(), zone);
    const initial = initialDate && isValidDateKey(initialDate) ? initialDate : current;
    const timer = window.setTimeout(() => {
      setTimeZone(zone);
      setToday(current);
      setSelectedDate(initial);
      setMonthKey(monthKeyForDate(initial));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialDate]);

  useEffect(() => {
    if (timeZone === null) return;
    const nextMidnight = new Date();
    nextMidnight.setHours(24, 0, 0, 25);
    const timer = window.setTimeout(() => setToday(getDateKeyInTimeZone(new Date(), timeZone)), nextMidnight.getTime() - Date.now());
    return () => window.clearTimeout(timer);
  }, [timeZone, today]);

  useEffect(() => {
    if (monthKey === null || timeZone === null) return;
    let cancelled = false;
    const month = getCalendarMonth(monthKey);
    const timer = window.setTimeout(() => {
      setMonthState({ status: "loading" });
      void Promise.all([repository.listForDateRange(month.startDate, month.endDate, timeZone), recurringRepository.listAll()]).then(
        ([entries, recurring]) => {
          if (cancelled) return;
          const years = Array.from(new Set(month.days.filter((day): day is string => day !== null).map((day) => Number(day.slice(0, 4)))));
          const occurrences = recurring.flatMap((entry) => years.map((year) => getRecurringOccurrence(entry, year)))
            .filter((occurrence) => occurrence.occurrenceDate >= month.startDate && occurrence.occurrenceDate < month.endDate);
          setMonthState({ status: "ready", entries, occurrences });
        },
        () => { if (!cancelled) setMonthState({ status: "error", message: "Calendar entries couldn’t be loaded. Please try again." }); },
      );
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [monthKey, recurringRepository, reloadKey, repository, timeZone]);

  useEffect(() => {
    if (monthState.status !== "ready" || selectedDate === null || keyboardFocusDate.current !== selectedDate) return;
    const target = document.getElementById(`calendar-date-${selectedDate}`);
    if (target) {
      target.focus();
      keyboardFocusDate.current = null;
    }
  }, [monthState, selectedDate]);

  const month = monthKey ? getCalendarMonth(monthKey) : null;
  const entriesForSelectedDate = useMemo(() => {
    if (monthState.status !== "ready" || selectedDate === null || timeZone === null) return [];
    return [...monthState.entries, ...monthState.occurrences].filter((entry) => getEntryDay(entry, timeZone) === selectedDate);
  }, [monthState, selectedDate, timeZone]);
  const entriesByDate = useMemo(() => {
    if (monthState.status !== "ready" || timeZone === null) return new Map<string, CalendarItem[]>();
    const grouped = new Map<string, CalendarItem[]>();
    for (const entry of [...monthState.entries, ...monthState.occurrences]) {
      const date = getEntryDay(entry, timeZone);
      if (date === null) continue;
      grouped.set(date, [...(grouped.get(date) ?? []), entry]);
    }
    return grouped;
  }, [monthState, timeZone]);

  const goToToday = useCallback(() => {
    if (today === null) return;
    setSelectedDate(today);
    setMonthKey(monthKeyForDate(today));
  }, [today]);

  const goToMonth = useCallback((offset: number) => {
    if (monthKey === null || selectedDate === null) return;
    const targetMonth = shiftMonth(monthKey, offset);
    setMonthKey(targetMonth);
    setSelectedDate(dateInMonth(targetMonth, Number(selectedDate.slice(-2))));
  }, [monthKey, selectedDate]);

  const selectedLabel = selectedDate && timeZone
    ? formatDateKey(selectedDate, { month: "long", day: "numeric" }).toUpperCase()
    : "";
  const monthLabel = monthKey
    ? formatDateKey(`${monthKey}-01`, { month: "long", year: "numeric" }).toUpperCase()
    : "CALENDAR";
  const selectedSummary = timeZone ? summarizeDay(entriesForSelectedDate, timeZone) : null;
  const chronological = [...entriesForSelectedDate].sort((left, right) => new Date(entryDate(left)).valueOf() - new Date(entryDate(right)).valueOf());

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-6 pb-32 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-10">
      <header className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <Link href="/" aria-label="ME ON GO Today" className="inline-flex min-h-11 items-center text-xs font-medium tracking-[0.2em] text-stone-200 transition-colors hover:text-amber-100">ME ON GO</Link>
        <span className="text-[10px] uppercase tracking-[0.2em] text-stone-600">Calendar</span>
      </header>

      <section aria-labelledby="calendar-heading" className="pt-10 sm:pt-14">
        <div className="flex items-center justify-between gap-3">
          <button type="button" aria-label="Previous month" onClick={() => goToMonth(-1)} disabled={!monthKey} className="flex h-11 w-11 items-center justify-center text-2xl font-light text-stone-400 transition-colors hover:text-amber-100 focus-visible:outline-2 focus-visible:outline-amber-200 disabled:opacity-30">‹</button>
          <h1 id="calendar-heading" className="text-center text-xl font-medium tracking-[0.16em] text-stone-100 sm:text-2xl">{monthLabel}</h1>
          <button type="button" aria-label="Next month" onClick={() => goToMonth(1)} disabled={!monthKey} className="flex h-11 w-11 items-center justify-center text-2xl font-light text-stone-400 transition-colors hover:text-amber-100 focus-visible:outline-2 focus-visible:outline-amber-200 disabled:opacity-30">›</button>
        </div>
        <div className="mt-3 flex justify-center">
          <button type="button" onClick={goToToday} disabled={!today} className="min-h-10 px-4 text-[10px] font-medium uppercase tracking-[0.22em] text-amber-100/75 transition-colors hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:opacity-30">Today</button>
        </div>

        {monthState.status === "loading" && <MonthLoading />}
        {monthState.status === "error" && (
          <div role="alert" className="mt-8 border-y border-white/[0.08] py-6">
            <p className="text-sm leading-6 text-stone-400">{monthState.message}</p>
            <button type="button" onClick={() => setReloadKey((current) => current + 1)} className="mt-3 min-h-11 border-b border-amber-100/30 text-sm text-amber-100/80 focus-visible:outline-2 focus-visible:outline-amber-200">Try again</button>
          </div>
        )}
        {month && monthState.status === "ready" && timeZone && today && (
          <div key={month.key} className="calendar-month-enter mt-5">
            <div role="row" className="grid grid-cols-7 gap-1 pb-2 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-stone-600">
              {weekdayNames.map((day, index) => <span key={`${day}-${index}`} role="columnheader" aria-label={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][index]} className="py-2">{day}</span>)}
            </div>
            <div role="grid" aria-label={`${monthLabel} dates`} className="space-y-1">
              {Array.from({ length: month.days.length / 7 }, (_, week) => (
                <div key={`${month.key}-week-${week}`} role="row" className="grid grid-cols-7 gap-1">
                  {month.days.slice(week * 7, week * 7 + 7).map((date, dayIndex) => {
                const index = week * 7 + dayIndex;
                if (!date) return <span key={`empty-${month.key}-${index}`} role="gridcell" aria-hidden="true" className="min-h-12 sm:min-h-[4.25rem]" />;
                const dayEntries = entriesByDate.get(date) ?? [];
                const isSelected = selectedDate === date;
                const isToday = today === date;
                const daySummary = summarizeDay(dayEntries, timeZone);
                const accessibleName = accessibleDateSummary(date, daySummary);
                return (
                  <div key={date} role="gridcell" aria-selected={isSelected} className="relative min-w-0">
                    <button
                      id={`calendar-date-${date}`}
                      type="button"
                      aria-label={accessibleName}
                      aria-current={isToday ? "date" : undefined}
                      onClick={() => setSelectedDate(date)}
                      onKeyDown={(event) => {
                        const moveBy: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
                        const offset = moveBy[event.key];
                        if (offset === undefined) return;
                        event.preventDefault();
                        const nextDate = addDaysToDateKey(date, offset);
                        keyboardFocusDate.current = nextDate;
                        setSelectedDate(nextDate);
                        const nextMonth = monthKeyForDate(nextDate);
                        if (nextMonth !== monthKey) setMonthKey(nextMonth);
                        else {
                          document.getElementById(`calendar-date-${nextDate}`)?.focus();
                          keyboardFocusDate.current = null;
                        }
                      }}
                      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
                      className={`relative flex min-h-[3.75rem] w-full flex-col items-center justify-center rounded-sm text-sm transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-200 sm:min-h-[4.5rem] sm:text-base ${isSelected ? "bg-white/[0.09] text-white" : "text-stone-300 hover:bg-white/[0.035] hover:text-white"}`}
                    >
                      <span className="relative flex h-8 w-8 items-center justify-center tabular-nums">
                        {Number(date.slice(-2))}
                        {isToday && <span aria-hidden="true" className="absolute -right-1 -top-0.5 h-1 w-1 rounded-full bg-amber-100/75" />}
                      </span>
                      <EntryIndicators entries={dayEntries} summary={daySummary} />
                    </button>
                  </div>
                );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {selectedDate && monthState.status === "ready" && timeZone && today && selectedSummary && (
        <section key={selectedDate} aria-labelledby="selected-date-heading" className="calendar-preview-enter mt-9 border-t border-white/[0.09] pt-6 sm:mt-12 sm:pt-8">
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-stone-500">Selected day</p>
          <h2 id="selected-date-heading" className="mt-2 text-2xl font-medium tracking-[-0.04em] text-stone-100 sm:text-3xl">{selectedLabel}</h2>
          {entriesForSelectedDate.length === 0 ? (
            <div className="mt-5">
              <p className="text-sm text-stone-500">Nothing recorded.</p>
              <Link href="/add" className="mt-4 inline-flex min-h-11 items-center gap-3 text-sm text-amber-100/80 transition-colors hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-amber-200"><span aria-hidden="true" className="text-xl font-light">+</span>Add something</Link>
            </div>
          ) : (
            <>
              <ul aria-label="Entry counts" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[10px] font-medium uppercase tracking-[0.15em] text-stone-500">
                {selectedSummary.pendingTasks.length > 0 && <li><span className="text-stone-200">{selectedSummary.pendingTasks.length}</span> Pending {selectedSummary.pendingTasks.length === 1 ? "Task" : "Tasks"}</li>}
                {selectedSummary.overdueTasks.length > 0 && <li className="text-red-200/65"><span>{selectedSummary.overdueTasks.length}</span> Overdue {selectedSummary.overdueTasks.length === 1 ? "Task" : "Tasks"}</li>}
                {selectedSummary.completedTasks.length > 0 && <li className="text-stone-700"><span>{selectedSummary.completedTasks.length}</span> Completed {selectedSummary.completedTasks.length === 1 ? "Task" : "Tasks"}</li>}
                {selectedSummary.events.length > 0 && <li><span className="text-stone-200">{selectedSummary.events.length}</span> {entryKindLabel("EVENT")}</li>}
                {selectedSummary.activities.length > 0 && <li><span className="text-stone-200">{selectedSummary.activities.length}</span> {entryKindLabel("ACTIVITY")}</li>}
                {selectedSummary.birthdays.length > 0 && <li className="text-violet-200/60"><span>{selectedSummary.birthdays.length}</span> {selectedSummary.birthdays.length === 1 ? "Birthday" : "Birthdays"}</li>}
                {selectedSummary.anniversaries.length > 0 && <li className="text-violet-200/60"><span>{selectedSummary.anniversaries.length}</span> {selectedSummary.anniversaries.length === 1 ? "Anniversary" : "Anniversaries"}</li>}
              </ul>
              <ol className="mt-5 divide-y divide-white/[0.06]">
                {chronological.slice(0, 5).map((entry) => (
                  <li key={entry.id}>
                    <Link href={"occurrenceDate" in entry ? `/recurring/${entry.id}` : `/entries/${entry.id}?from=calendar&date=${selectedDate}`} className="flex min-h-14 items-center gap-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">
                      <span className="w-16 shrink-0 font-mono text-[9px] tabular-nums text-stone-500 sm:text-[10px]">{"occurrenceDate" in entry ? "ALL DAY" : entry.kind === "TASK" && entry.dueAt && isDateOnlyTimestamp(entry.dueAt, timeZone) ? "DATE ONLY" : shortTime(entry, timeZone) ?? "— —"}</span>
                      <span className="min-w-0 flex-1"><span className={`block truncate text-sm ${entry.kind === "TASK" && entry.completedAt !== null ? "text-stone-500 line-through decoration-stone-700" : "text-stone-200"}`}>{entry.title}{"occurrenceDate" in entry && entry.yearsSince !== null ? <span className="ml-2 text-xs text-stone-500">{entry.yearsSince} years</span> : null}</span>{entry.kind === "TASK" && <span className={`mt-1 block truncate text-[9px] uppercase tracking-[0.14em] ${entry.completedAt !== null ? "text-stone-700" : entry.priority === "HIGH" ? "text-amber-100/70" : "text-stone-600"}`}>{entry.completedAt !== null ? "Completed" : entry.priority}{entry.category ? ` · ${entry.category}` : ""}</span>}</span>
                      <span className={`text-[9px] uppercase tracking-[0.13em] ${entry.kind === "TASK" && entry.completedAt !== null ? "text-stone-700" : "text-stone-600"}`}>{"occurrenceDate" in entry ? entry.kind : entry.kind}{entry.kind === "TASK" && entry.completedAt !== null ? " · DONE" : ""}</span>
                    </Link>
                  </li>
                ))}
              </ol>
              {chronological.length > 5 && <p className="mt-3 text-xs text-stone-600">+ {chronological.length - 5} more</p>}
              <Link href={`/calendar/day?date=${selectedDate}`} className="mt-5 inline-flex min-h-11 items-center gap-3 border-b border-amber-100/25 pb-1 text-xs font-medium uppercase tracking-[0.18em] text-amber-100/80 transition-colors hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200">View day <span aria-hidden="true">→</span></Link>
            </>
          )}
        </section>
      )}
    </main>
  );
}
