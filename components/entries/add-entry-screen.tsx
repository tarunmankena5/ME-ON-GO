"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createEntryRepository } from "@/lib/data/create-entry-repository";
import { createTrackerRepository } from "@/lib/data/create-tracker-repository";
import { formatInTimeZone, getDateKeyInTimeZone, getDeviceTimeZone, isDateOnlyTimestamp } from "@/lib/dates/time-zone";
import type { Entry, EntryChanges, EntryKind, NewEntry, TaskPriority } from "@/types/entry";
import type { TrackerDefinition } from "@/types/tracker";

type Draft = {
  title: string;
  notes: string;
  date: string;
  time: string;
  endTime: string;
  activityType: string;
  priority: TaskPriority;
  category: string;
  completed: boolean;
};

const typeOptions: { kind: EntryKind; description: string; prompt: string }[] = [
  { kind: "ACTIVITY", description: "Something that happened", prompt: "What happened?" },
  { kind: "TASK", description: "Something I need to do", prompt: "What needs doing?" },
  { kind: "EVENT", description: "Something scheduled", prompt: "What’s scheduled?" },
];

function localDateTimeToIso(date: string, time: string): string {
  const value = new Date(`${date}T${time || "12:00"}`);
  if (Number.isNaN(value.valueOf())) throw new Error("Choose a valid date and time.");
  return value.toISOString();
}

function freshDraft(): Draft {
  const now = new Date();
  return {
    title: "",
    notes: "",
    date: getDateKeyInTimeZone(now, getDeviceTimeZone()),
    time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    endTime: "",
    activityType: "",
    priority: "NORMAL",
    category: "",
    completed: false,
  };
}

function draftFromEntry(entry: Entry): Draft {
  const timeZone = getDeviceTimeZone();
  const timestamp = entry.kind === "ACTIVITY"
    ? entry.occurredAt
    : entry.kind === "TASK"
      ? entry.dueAt
      : entry.startsAt;
  const date = timestamp ? getDateKeyInTimeZone(new Date(timestamp), timeZone) : "";
  const time = timestamp && !(entry.kind === "TASK" && isDateOnlyTimestamp(timestamp, timeZone))
    ? formatInTimeZone(timestamp, timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    : "";
  return {
    title: entry.title,
    notes: entry.notes ?? "",
    date,
    time,
    endTime: entry.kind === "EVENT" && entry.endsAt
      ? formatInTimeZone(entry.endsAt, timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      : "",
    activityType: entry.kind === "ACTIVITY" ? entry.activityType ?? "" : "",
    priority: entry.kind === "TASK" ? entry.priority : "NORMAL",
    category: entry.kind === "TASK" ? entry.category ?? "" : "",
    completed: entry.kind === "TASK" && entry.completedAt !== null,
  };
}

type AddEntryScreenProps = {
  entry?: Entry;
  onCancel?: () => void;
  onSaved?: (entry: Entry) => void;
};

function inputClassName() {
  return "mt-2 min-h-12 w-full border-b border-white/15 bg-transparent px-0 py-3 text-base text-stone-100 outline-none transition-colors placeholder:text-stone-700 focus:border-amber-100/60 focus-visible:ring-2 focus-visible:ring-amber-100/30";
}

export function AddEntryScreen({ entry, onCancel, onSaved }: AddEntryScreenProps) {
  const router = useRouter();
  const repository = useMemo(() => createEntryRepository(), []);
  const trackerRepository = useMemo(() => createTrackerRepository(), []);
  const editing = Boolean(entry);
  const [kind, setKind] = useState<EntryKind | null>(entry?.kind ?? null);
  const [showTrackers, setShowTrackers] = useState(false);
  const [trackersState, setTrackersState] = useState<{ status: "loading" | "ready" | "error"; trackers: TrackerDefinition[] }>({ status: "loading", trackers: [] });
  const [draft, setDraft] = useState<Draft>(entry ? draftFromEntry(entry) : {
    title: "",
    notes: "",
    date: "",
    time: "",
    endTime: "",
    activityType: "",
    priority: "NORMAL",
    category: "",
    completed: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [dirty, setDirty] = useState(false);

  const isDirty = dirty;

  useEffect(() => {
    if (!showTrackers) return;
    let cancelled = false;
    void trackerRepository.listTrackers().then((trackers) => {
      if (!cancelled) setTrackersState({ status: "ready", trackers });
    }).catch(() => {
      if (!cancelled) setTrackersState({ status: "error", trackers: [] });
    });
    return () => { cancelled = true; };
  }, [showTrackers, trackerRepository]);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
    setSaveError(null);
    setDirty(true);
  }

  function chooseKind(nextKind: EntryKind) {
    const nextDraft = freshDraft();
    if (nextKind === "TASK") {
      nextDraft.date = "";
      nextDraft.time = "";
    }
    setDraft(nextDraft);
    setKind(nextKind);
    setError(null);
    setSaveError(null);
    setDirty(false);
  }

  function leave() {
    if (editing) onCancel?.();
    else router.push("/");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!kind) return;

    const title = draft.title.trim();
    if (!title) {
      setError("Add a title to continue.");
      return;
    }
    if (kind !== "TASK" && (!draft.date || !draft.time)) {
      setError("Choose a date and time to continue.");
      return;
    }
    if (kind === "TASK" && !draft.date && draft.time) {
      setError("Choose a due date before adding a due time.");
      return;
    }
    if (kind === "EVENT" && (!draft.date || !draft.time)) {
      setError("Choose a date and start time for this event.");
      return;
    }
    if (kind === "EVENT" && draft.endTime && draft.endTime <= draft.time) {
      setError("End time must be after the start time.");
      return;
    }

    let input: NewEntry | EntryChanges;
    try {
      const notes = draft.notes.trim() || null;
      if (kind === "ACTIVITY") {
        input = editing
          ? { title, notes, activityType: draft.activityType.trim() || null, occurredAt: localDateTimeToIso(draft.date, draft.time) }
          : { kind, title, notes, metadata: {}, activityType: draft.activityType.trim() || null, occurredAt: localDateTimeToIso(draft.date, draft.time) };
      } else if (kind === "TASK") {
        const dueAt = draft.date ? localDateTimeToIso(draft.date, draft.time || "00:00") : null;
        const completedAt = draft.completed
          ? entry?.kind === "TASK" && entry.completedAt !== null ? entry.completedAt : new Date().toISOString()
          : null;
        input = editing
          ? { title, notes, dueAt, priority: draft.priority, category: draft.category.trim() || null, completedAt }
          : { kind, title, notes, metadata: {}, dueAt, priority: draft.priority, category: draft.category.trim() || null, completedAt };
      } else {
        const startsAt = localDateTimeToIso(draft.date, draft.time);
        const endsAt = draft.endTime ? localDateTimeToIso(draft.date, draft.endTime) : null;
        input = editing
          ? { title, notes, startsAt, endsAt }
          : { kind, title, notes, metadata: {}, startsAt, endsAt };
      }
    } catch {
      setError("Choose a valid date and time.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const saved = editing && entry
        ? await repository.update(entry.id, input as EntryChanges)
        : await repository.create(input as NewEntry);
      if (onSaved) onSaved(saved);
      else {
        router.replace("/");
        router.refresh();
      }
    } catch {
      setSaveError("This entry couldn’t be saved. Please try again.");
      setSaving(false);
    }
  }

  const selected = typeOptions.find((option) => option.kind === kind);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-10">
      <header className="flex min-h-14 items-center justify-between border-b border-white/[0.08]">
        <Link
          href={editing && entry ? `/entries/${entry.id}` : "/"}
          onClick={(event) => {
            if (editing) {
              event.preventDefault();
              if (isDirty) setConfirmLeave(true);
              else leave();
            } else if (isDirty) {
              event.preventDefault();
              setConfirmLeave(true);
            }
          }}
          aria-label={editing ? "Back to entry" : "Back to Today"}
          className="inline-flex min-h-11 items-center text-xs font-medium tracking-[0.2em] text-stone-200 transition-colors hover:text-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
        >
          ME ON GO
        </Link>
        {kind && (
          <button
            type="button"
            onClick={() => {
              if (isDirty) setConfirmLeave(true);
              else if (editing) leave();
              else setKind(null);
            }}
            className="inline-flex min-h-11 items-center px-2 text-sm text-stone-400 transition-colors hover:text-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
          >
            Cancel
          </button>
        )}
      </header>

      <section className="flex-1 pb-6 pt-12 sm:pt-16" aria-live="polite">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-amber-100/70">{editing ? "Edit entry" : "Add"}</p>
        <h1 className="mt-4 text-4xl font-medium tracking-[-0.055em] text-stone-100 sm:text-5xl">
          {editing && selected ? `Edit ${selected.kind.toLowerCase()}` : selected ? selected.prompt : "What is this?"}
        </h1>

        {!kind ? (
          <>
          <div className="mt-10 border-y border-white/[0.08]">
            {typeOptions.map((option, index) => (
              <button
                key={option.kind}
                type="button"
                onClick={() => chooseKind(option.kind)}
                className={`group flex min-h-24 w-full items-center justify-between gap-4 text-left transition-colors hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-amber-200 ${index > 0 ? "border-t border-white/[0.07]" : ""}`}
              >
                <span>
                  <span className="block text-sm font-medium tracking-[0.16em] text-stone-100">{option.kind}</span>
                  <span className="mt-2 block text-sm text-stone-500">{option.description}</span>
                </span>
                <span aria-hidden="true" className="text-xl text-stone-600 transition-transform group-hover:translate-x-1 group-hover:text-amber-100">→</span>
              </button>
            ))}
          </div>
          <div className="mt-8">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone-600">Remember every year</p>
            <div className="mt-2 divide-y divide-white/[0.07] border-y border-white/[0.08]">
              {([
                ["BIRTHDAY", "Birthday", "A person’s date, repeated yearly"],
                ["ANNIVERSARY", "Anniversary", "A date you celebrate each year"],
              ] as const).map(([kind, label, description]) => (
                <Link key={kind} href={`/recurring/new?kind=${kind}`} className="flex min-h-20 items-center justify-between gap-4 text-left transition-colors hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-amber-200">
                  <span><span className="block text-sm font-medium text-stone-200">{label}</span><span className="mt-1 block text-sm text-stone-600">{description}</span></span>
                  <span aria-hidden="true" className="text-stone-600">→</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-8">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone-600">Track something</p>
            <button type="button" onClick={() => setShowTrackers(true)} className="mt-2 flex w-full min-h-20 items-center justify-between gap-4 border-y border-white/[0.08] text-left transition-colors hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-amber-200">
              <span><span className="block text-sm font-medium text-stone-200">Custom Tracker</span><span className="mt-1 block text-sm text-stone-600">Record a workout, reading, sleep, or more</span></span>
              <span aria-hidden="true" className="text-stone-600">→</span>
            </button>
          </div>
          </>
        ) : showTrackers ? (
          <div className="add-form-enter mt-8 border-y border-white/[0.08]">
            {trackersState.status === "loading" ? (
              <p className="py-5 text-sm text-stone-600">Loading trackers…</p>
            ) : trackersState.status === "error" ? (
              <p className="py-5 text-sm text-red-200/80">Trackers couldn’t be loaded.</p>
            ) : trackersState.trackers.length === 0 ? (
              <div className="py-5">
                <p className="text-sm text-stone-400">You haven’t created any trackers yet.</p>
                <Link href="/trackers/new" className="mt-4 inline-flex min-h-11 items-center text-sm text-amber-100 transition-colors hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-amber-200">Create a tracker</Link>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.07]">
                {trackersState.trackers.map((tracker) => (
                  <Link key={tracker.id} href={`/trackers/${tracker.id}/records/new`} className="group flex min-h-20 w-full items-center justify-between gap-4 text-left transition-colors hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-amber-200">
                    <span>
                      <span className="block text-sm font-medium tracking-[0.05em] text-stone-100">{tracker.name}</span>
                      {tracker.description && <span className="mt-2 block truncate text-sm text-stone-500">{tracker.description}</span>}
                    </span>
                    <span aria-hidden="true" className="text-xl text-stone-600 transition-transform group-hover:translate-x-1 group-hover:text-amber-100">→</span>
                  </Link>
                ))}
                <Link href="/trackers/new" className="flex min-h-20 items-center justify-between gap-4 text-left text-sm text-amber-100/80 transition-colors hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-amber-200">
                  <span>Create new tracker</span><span aria-hidden="true" className="text-xl font-light">+</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="add-form-enter mt-8 space-y-7" noValidate>
            <div>
              <label htmlFor="entry-title" className="text-sm text-stone-400">Title <span className="text-amber-100/70">*</span></label>
              <input
                id="entry-title"
                name="title"
                autoFocus
                required
                maxLength={160}
                value={draft.title}
                onChange={(event) => updateDraft("title", event.target.value)}
                placeholder={kind === "ACTIVITY" ? "What happened?" : kind === "TASK" ? "What needs doing?" : "What’s scheduled?"}
                className={inputClassName()}
              />
            </div>

            {kind !== "TASK" && (
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label htmlFor="entry-date" className="text-sm text-stone-400">{kind === "EVENT" ? "Date *" : "Date"}</label>
                  <input id="entry-date" name="date" type="date" required={kind === "EVENT"} value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} className={inputClassName()} />
                </div>
                <div>
                  <label htmlFor="entry-time" className="text-sm text-stone-400">{kind === "EVENT" ? "Start time *" : "Time"}</label>
                  <input id="entry-time" name="time" type="time" required={kind === "EVENT"} value={draft.time} onChange={(event) => updateDraft("time", event.target.value)} className={inputClassName()} />
                </div>
              </div>
            )}

            {kind === "TASK" && (
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label htmlFor="entry-date" className="text-sm text-stone-400">Due date <span className="text-stone-600">· optional</span></label>
                  <input id="entry-date" name="date" type="date" value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} className={inputClassName()} />
                </div>
                <div>
                  <label htmlFor="entry-time" className="text-sm text-stone-400">Due time <span className="text-stone-600">· optional</span></label>
                  <input id="entry-time" name="time" type="time" value={draft.time} onChange={(event) => updateDraft("time", event.target.value)} className={inputClassName()} />
                </div>
              </div>
            )}

            {kind === "TASK" && (
              <>
                <div>
                  <label htmlFor="task-category" className="text-sm text-stone-400">Category <span className="text-stone-600">· optional</span></label>
                  <input id="task-category" name="category" maxLength={80} value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} placeholder="e.g. Work, Personal, Study" className={inputClassName()} />
                </div>
                <p className="-mt-5 text-xs text-stone-600">
                  {!draft.date ? "No deadline" : draft.time ? "Date and time" : "Date only · no due time"}
                </p>
              </>
            )}

            {kind === "EVENT" && (
              <div>
                <label htmlFor="entry-end-time" className="text-sm text-stone-400">End time <span className="text-stone-600">· optional</span></label>
                <input id="entry-end-time" name="endTime" type="time" value={draft.endTime} onChange={(event) => updateDraft("endTime", event.target.value)} className={`${inputClassName()} max-w-[calc(50%-0.625rem)]`} />
              </div>
            )}

            {kind === "ACTIVITY" && (
              <div>
                <label htmlFor="activity-type" className="text-sm text-stone-400">Activity type <span className="text-stone-600">· optional</span></label>
                <input id="activity-type" name="activityType" maxLength={80} value={draft.activityType} onChange={(event) => updateDraft("activityType", event.target.value)} placeholder="e.g. Call, study, exercise" className={inputClassName()} />
              </div>
            )}

            {kind === "TASK" && (
              <fieldset>
                <legend className="text-sm text-stone-400">Priority</legend>
                <div className="mt-3 flex gap-2" role="group" aria-label="Task priority">
                  {(["LOW", "NORMAL", "HIGH"] as const).map((priority) => (
                    <button
                      key={priority}
                      type="button"
                      aria-pressed={draft.priority === priority}
                      onClick={() => updateDraft("priority", priority)}
                      className={`min-h-11 flex-1 border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 ${draft.priority === priority ? "border-amber-100/50 text-amber-50" : "border-white/[0.1] text-stone-500 hover:text-stone-200"}`}
                    >
                      {priority[0] + priority.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {editing && kind === "TASK" && (
              <label className="flex min-h-11 items-center gap-3 text-sm text-stone-300">
                <input type="checkbox" checked={draft.completed} onChange={(event) => updateDraft("completed", event.target.checked)} className="h-4 w-4 accent-amber-100" />
                Completed
              </label>
            )}

            <div>
              <label htmlFor="entry-notes" className="text-sm text-stone-400">Notes <span className="text-stone-600">· optional</span></label>
              <textarea id="entry-notes" name="notes" rows={3} maxLength={2000} value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} placeholder="Add a note" className={`${inputClassName()} min-h-24 resize-y`} />
            </div>

            <div className="sticky bottom-0 -mx-6 mt-2 bg-gradient-to-t from-[#090a0b] via-[#090a0b] to-transparent px-6 pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:px-0 sm:pb-0">
              {error && <p role="alert" className="mb-3 text-sm text-amber-100/90">{error}</p>}
              {saveError && <p role="alert" className="mb-3 text-sm text-red-200">{saveError}</p>}

              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-14 w-full items-center justify-center border border-amber-100/35 px-5 text-sm font-medium tracking-[0.12em] text-amber-50 transition-colors hover:border-amber-100/65 hover:bg-amber-100/[0.05] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200 disabled:cursor-wait disabled:opacity-60"
              >
                {saving ? "SAVING…" : editing ? "SAVE CHANGES" : kind === "ACTIVITY" ? "SAVE ACTIVITY" : kind === "TASK" ? "ADD TASK" : "ADD EVENT"}
              </button>
            </div>
          </form>
        )}
      </section>

      {confirmLeave && (
        <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center" role="presentation">
          <section role="alertdialog" aria-modal="true" aria-labelledby="leave-title" className="w-full max-w-sm border border-white/10 bg-[#111213] p-6 shadow-2xl">
            <h2 id="leave-title" className="text-lg text-stone-100">Leave without saving?</h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">Your changes will be discarded.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" autoFocus onClick={() => setConfirmLeave(false)} className="min-h-11 px-3 text-sm text-stone-300 focus-visible:outline-2 focus-visible:outline-amber-200">Keep editing</button>
              <button type="button" onClick={leave} className="min-h-11 border border-white/15 px-4 text-sm text-stone-100 focus-visible:outline-2 focus-visible:outline-amber-200">Discard</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
