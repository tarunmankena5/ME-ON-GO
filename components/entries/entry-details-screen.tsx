"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AddEntryScreen } from "@/components/entries/add-entry-screen";
import { createEntryRepository } from "@/lib/data/create-entry-repository";
import { formatInTimeZone, getDeviceTimeZone, isDateOnlyTimestamp } from "@/lib/dates/time-zone";
import { deadlineLabel, isTaskOverdue } from "@/lib/dates/task-state";
import type { Entry, TaskEntry } from "@/types/entry";

type DetailState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "not-found" }
  | { status: "ready"; entry: Entry };

function formatDateTime(value: string, timeZone: string): string {
  return formatInTimeZone(value, timeZone, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

function formatTaskDeadline(value: string, timeZone: string): string {
  return formatInTimeZone(value, timeZone, isDateOnlyTimestamp(value, timeZone)
    ? { weekday: "long", month: "long", day: "numeric", year: "numeric" }
    : { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

function kindLabel(entry: Entry): string {
  return entry.kind[0] + entry.kind.slice(1).toLowerCase();
}

function LoadingDetails() {
  return (
    <div role="status" aria-live="polite" className="mt-16 space-y-6">
      <span className="sr-only">Loading entry</span>
      <div className="h-3 w-24 animate-pulse bg-white/[0.07]" />
      <div className="h-12 w-80 max-w-full animate-pulse bg-white/[0.06]" />
      <div className="h-px w-full bg-white/[0.06]" />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 border-t border-white/[0.07] py-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <dt className="text-sm text-stone-500">{label}</dt>
      <dd className="min-w-0 text-sm leading-6 text-stone-200">{value}</dd>
    </div>
  );
}

export function EntryDetailsScreen({ id, returnHref }: { id: string; returnHref: string }) {
  const router = useRouter();
  const repository = useMemo(() => createEntryRepository(), []);
  const [screen, setScreen] = useState<DetailState>({ status: "loading" });
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const timeZone = getDeviceTimeZone();

  const loadEntry = useCallback(async () => {
    try {
      const entry = await repository.findById(id);
      setScreen(entry ? { status: "ready", entry } : { status: "not-found" });
    } catch {
      setScreen({ status: "error", message: "This entry couldn’t be loaded. Please try again." });
    }
  }, [id, repository]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEntry(), 0);
    return () => window.clearTimeout(timer);
  }, [loadEntry]);

  const onToggleTask = useCallback(async (task: TaskEntry) => {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await repository.update(task.id, {
        completedAt: task.completedAt === null ? new Date().toISOString() : null,
      });
      setScreen({ status: "ready", entry: updated });
    } catch {
      setActionError("That task couldn’t be updated. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [repository]);

  const onDelete = useCallback(async () => {
    if (screen.status !== "ready") return;
    setBusy(true);
    setActionError(null);
    try {
      await repository.delete(screen.entry.id);
      router.replace(returnHref);
      router.refresh();
    } catch {
      setBusy(false);
      setActionError("This entry couldn’t be deleted. Please try again.");
      setConfirmDelete(false);
    }
  }, [repository, returnHref, router, screen]);

  if (editing && screen.status === "ready") {
    return (
      <AddEntryScreen
        key={screen.entry.id}
        entry={screen.entry}
        onCancel={() => setEditing(false)}
        onSaved={(updated) => {
          setScreen({ status: "ready", entry: updated });
          setEditing(false);
          setActionError(null);
        }}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-10">
      <header className="flex min-h-14 items-center justify-between border-b border-white/[0.08]">
        <Link href={returnHref} className="inline-flex min-h-11 items-center text-xs font-medium tracking-[0.2em] text-stone-200 transition-colors hover:text-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">
          ME ON GO
        </Link>
        {screen.status === "ready" && (
          <span className="text-[10px] uppercase tracking-[0.2em] text-stone-600">{kindLabel(screen.entry)}</span>
        )}
      </header>

      {screen.status === "loading" && <LoadingDetails />}

      {screen.status === "error" && (
        <section className="flex flex-1 flex-col justify-center py-16" role="alert">
          <p className="text-base leading-6 text-stone-300">{screen.message}</p>
          <button type="button" onClick={() => void loadEntry()} className="mt-5 min-h-11 w-fit border-b border-amber-100/30 text-sm text-amber-100/80 hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-amber-200">Try again</button>
        </section>
      )}

      {screen.status === "not-found" && (
        <section className="flex flex-1 flex-col justify-center py-16">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-stone-600">Entry unavailable</p>
          <h1 className="mt-4 text-3xl font-medium tracking-[-0.045em] text-stone-100">We couldn’t find this entry.</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-stone-500">It may have been deleted or the link may be out of date.</p>
          <Link href={returnHref} className="mt-8 inline-flex min-h-11 w-fit items-center border-b border-white/15 text-sm text-stone-300 hover:border-amber-100/40 hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200">Back to Today</Link>
        </section>
      )}

      {screen.status === "ready" && (
        <>
          <article className="flex-1 pb-12 pt-12 sm:pt-16">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-amber-100/70">{kindLabel(screen.entry)}</p>
            <h1 className={`mt-4 break-words text-4xl font-medium leading-tight tracking-[-0.055em] sm:text-5xl ${screen.entry.kind === "TASK" && screen.entry.completedAt ? "text-stone-500 line-through decoration-stone-700" : "text-stone-100"}`}>
              {screen.entry.title}
            </h1>

            <dl className="mt-10">
              {screen.entry.kind === "ACTIVITY" && (
                <>
                  <DetailRow label="When" value={formatDateTime(screen.entry.occurredAt, timeZone)} />
                  {screen.entry.activityType && <DetailRow label="Activity type" value={screen.entry.activityType} />}
                </>
              )}
              {screen.entry.kind === "TASK" && (
                <>
                  {screen.entry.dueAt && <DetailRow label="Due" value={formatTaskDeadline(screen.entry.dueAt, timeZone)} />}
                  {screen.entry.category && <DetailRow label="Category" value={screen.entry.category} />}
                  <DetailRow label="Priority" value={screen.entry.priority} />
                  <DetailRow label="Status" value={screen.entry.completedAt
                    ? `Completed · ${formatDateTime(screen.entry.completedAt, timeZone)}`
                    : isTaskOverdue(screen.entry, new Date(), timeZone)
                      ? `Overdue · ${deadlineLabel(screen.entry, new Date(), timeZone)}`
                      : "Pending"} />
                </>
              )}
              {screen.entry.kind === "EVENT" && (
                <>
                  <DetailRow label="Starts" value={formatDateTime(screen.entry.startsAt, timeZone)} />
                  {screen.entry.endsAt && <DetailRow label="Ends" value={formatDateTime(screen.entry.endsAt, timeZone)} />}
                </>
              )}
            </dl>

            {screen.entry.notes && (
              <section aria-labelledby="entry-notes-heading" className="mt-9 border-t border-white/[0.07] pt-5">
                <h2 id="entry-notes-heading" className="text-xs font-medium uppercase tracking-[0.2em] text-stone-500">Notes</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-300">{screen.entry.notes}</p>
              </section>
            )}

            {actionError && <p role="alert" className="mt-6 text-sm text-red-200">{actionError}</p>}

            <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-2 border-t border-white/[0.08] pt-4">
              <button type="button" disabled={busy} onClick={() => setEditing(true)} className="inline-flex min-h-12 items-center text-sm text-stone-200 transition-colors hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:opacity-60">Edit entry</button>
              {screen.entry.kind === "TASK" && (
                <button type="button" disabled={busy} aria-pressed={screen.entry.completedAt !== null} onClick={() => {
                  const current = screen.entry;
                  if (current.kind === "TASK") void onToggleTask(current);
                }} className="inline-flex min-h-12 items-center text-sm text-amber-100/80 transition-colors hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:opacity-60">
                  {screen.entry.completedAt ? "Mark incomplete" : "Mark complete"}
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)} className="inline-flex min-h-12 items-center text-sm text-stone-500 transition-colors hover:text-red-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:opacity-60">Delete entry</button>
            </div>
          </article>

          {confirmDelete && (
            <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center" role="presentation">
              <section role="alertdialog" aria-modal="true" aria-labelledby="delete-entry-title" aria-describedby="delete-entry-description" className="w-full max-w-sm border border-white/10 bg-[#111213] p-6 shadow-2xl">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-stone-500">Delete {kindLabel(screen.entry)}</p>
                <h2 id="delete-entry-title" className="mt-3 break-words text-xl font-medium text-stone-100">Delete “{screen.entry.title}”?</h2>
                <p id="delete-entry-description" className="mt-2 text-sm leading-6 text-stone-500">This entry will be removed from this device.</p>
                {actionError && <p role="alert" className="mt-3 text-sm text-red-200">{actionError}</p>}
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} className="min-h-11 px-3 text-sm text-stone-300 focus-visible:outline-2 focus-visible:outline-amber-200 disabled:opacity-60">Keep entry</button>
                  <button type="button" disabled={busy} onClick={() => void onDelete()} className="min-h-11 border border-red-200/30 px-4 text-sm text-red-100 transition-colors hover:bg-red-200/[0.06] focus-visible:outline-2 focus-visible:outline-amber-200 disabled:opacity-60">{busy ? "Deleting…" : "Delete entry"}</button>
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
}
