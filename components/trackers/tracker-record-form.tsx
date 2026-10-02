"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createTrackerRepository } from "@/lib/data/create-tracker-repository";
import { formatInTimeZone, getDateKeyInTimeZone, getDeviceTimeZone } from "@/lib/dates/time-zone";
import { parseDuration, validateTrackerRecord } from "@/lib/data/tracker-validation";
import { initialFieldInput, TrackerFieldInputControl } from "@/components/trackers/tracker-field-input";
import type { TrackerDefinition, TrackerRecord, TrackerValues } from "@/types/tracker";

type DraftValue = string | boolean;
function dateTime(date: string, time: string): string | null {
  if (!time) return null;
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.valueOf()) ? "" : value.toISOString();
}

function initialDraft(tracker: TrackerDefinition, record: TrackerRecord | null) {
  const timezone = getDeviceTimeZone();
  const now = new Date();
  const date = record?.occurredOn ?? getDateKeyInTimeZone(now, timezone);
  const time = record?.occurredAt ? formatInTimeZone(record.occurredAt, timezone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const values: Record<string, DraftValue> = {};
  for (const field of tracker.fields) {
    if (!field.active) continue;
    values[field.id] = initialFieldInput(field, record?.values[field.id]);
  }
  return { date, time, values };
}

function buildValues(tracker: TrackerDefinition, draft: { values: Record<string, DraftValue> }, oldRecord: TrackerRecord | null): { values?: TrackerValues; error?: string } {
  const values: TrackerValues = {};
  for (const field of tracker.fields) {
    if (!field.active) {
      if (oldRecord && Object.hasOwn(oldRecord.values, field.id)) values[field.id] = oldRecord.values[field.id];
      continue;
    }
    const input = draft.values[field.id];
    if (input === undefined || input === "") continue;
    switch (field.type) {
      case "NUMBER":
        values[field.id] = Number(input);
        break;
      case "DURATION": {
        const seconds = parseDuration(String(input));
        if (seconds === null) return { error: `${field.name} needs mm:ss or hh:mm:ss.` };
        values[field.id] = seconds;
        break;
      }
      case "RATING":
        values[field.id] = Number(input);
        break;
      case "BOOLEAN":
        values[field.id] = Boolean(input);
        break;
      default:
        values[field.id] = String(input);
    }
  }
  return { values };
}

export function TrackerRecordForm({ trackerId, recordId }: { trackerId: string; recordId?: string }) {
  const router = useRouter();
  const repository = useMemo(() => createTrackerRepository(), []);
  const [tracker, setTracker] = useState<TrackerDefinition | null>(null);
  const [record, setRecord] = useState<TrackerRecord | null>(null);
  const [draft, setDraft] = useState<{ date: string; time: string; values: Record<string, DraftValue> } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found">("loading");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void repository.findTracker(trackerId).then(async (found) => {
      if (!found) { if (!cancelled) setStatus("not-found"); return; }
      const existing = recordId ? await repository.findRecord(trackerId, recordId) : null;
      if (recordId && !existing) { if (!cancelled) setStatus("not-found"); return; }
      if (cancelled) return;
      setTracker(found); setRecord(existing); setDraft(initialDraft(found, existing)); setStatus("ready");
    }).catch(() => { if (!cancelled) setStatus("not-found"); });
    return () => { cancelled = true; };
  }, [recordId, repository, trackerId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tracker || !draft) return;
    const built = buildValues(tracker, draft, record);
    if (!built.values) { setError(built.error ?? "Check the field values."); return; }
    const occurredAt = dateTime(draft.date, draft.time);
    if (occurredAt === "") { setError("Choose a valid local date and time."); return; }
    const input = { occurredOn: draft.date, occurredAt, values: built.values };
    const validation = validateTrackerRecord(tracker, input, tracker.fields.filter((field) => !field.active && record && Object.hasOwn(record.values, field.id)).map((field) => field.id));
    if (validation) { setError(validation); return; }
    setSaving(true); setError("");
    try {
      await (recordId ? repository.updateRecord(tracker.id, recordId, input) : repository.createRecord(tracker.id, input));
      router.replace(`/trackers/${tracker.id}`); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "This record couldn’t be saved. Please try again."); setSaving(false); }
  }

  if (status === "loading") return <main className="mx-auto max-w-3xl px-6 pt-16 text-sm text-stone-500">Loading record…</main>;
  if (status === "not-found" || !tracker || !draft) return <main className="mx-auto max-w-3xl px-6 pt-16"><h1 className="text-3xl text-stone-100">Record not found</h1><Link className="mt-6 inline-flex min-h-11 items-center text-amber-100" href={`/trackers/${trackerId}`}>Back to tracker</Link></main>;
  const activeFields = tracker.fields.filter((field) => field.active);
  return <main className="mx-auto min-h-dvh w-full max-w-3xl px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-10">
    <header className="flex min-h-14 items-center justify-between border-b border-white/[0.08]"><Link href={`/trackers/${tracker.id}`} className="inline-flex min-h-11 items-center text-xs tracking-[0.2em] text-stone-200">ME ON GO</Link><Link href={record ? `/trackers/${tracker.id}/records/${record.id}` : `/trackers/${tracker.id}`} className="inline-flex min-h-11 items-center text-sm text-stone-500">Cancel</Link></header>
    <section className="pt-10 sm:pt-14"><p className="text-xs uppercase tracking-[0.24em] text-amber-100/70">{tracker.name}</p><h1 className="mt-4 break-words text-4xl font-medium tracking-[-0.055em] text-stone-100 sm:text-5xl">{record ? "Edit record" : "Add a record"}</h1>
      <form onSubmit={submit} className="mt-8 space-y-7" noValidate>
        <div><label htmlFor="record-date" className="text-sm text-stone-400">Date <span className="text-amber-100/70">*</span></label><input id="record-date" type="date" required value={draft.date} onChange={(event) => setDraft((current) => current && ({ ...current, date: event.target.value }))} className="mt-2 min-h-12 w-full border-b border-white/15 bg-transparent px-0 py-3 text-base text-stone-100 focus-visible:outline-2 focus-visible:outline-amber-200"/></div>
        <div><label htmlFor="record-time" className="text-sm text-stone-400">Time <span className="text-stone-600">· optional</span></label><input id="record-time" type="time" value={draft.time} onChange={(event) => setDraft((current) => current && ({ ...current, time: event.target.value }))} className="mt-2 min-h-12 w-full border-b border-white/15 bg-transparent px-0 py-3 text-base text-stone-100 focus-visible:outline-2 focus-visible:outline-amber-200"/><p className="mt-1 text-xs text-stone-600">Clear the time to keep this record date-only.</p></div>
        {activeFields.map((field) => <TrackerFieldInputControl key={field.id} field={field} value={draft.values[field.id] ?? ""} onChange={(value) => setDraft((current) => current && ({ ...current, values: { ...current.values, [field.id]: value } }))} idPrefix="record-field"/>)}
        {record && tracker.fields.some((field) => !field.active && Object.hasOwn(record.values, field.id)) && <p className="text-xs leading-5 text-stone-600">Inactive field values are preserved in this record’s history.</p>}
        {error && <p role="alert" className="text-sm text-red-200/90">{error}</p>}
        <div className="sticky bottom-0 -mx-6 bg-gradient-to-t from-[#090a0b] via-[#090a0b] to-transparent px-6 pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:px-0 sm:pb-0"><button disabled={saving} className="min-h-14 w-full border border-amber-100/35 px-5 text-sm font-medium tracking-[0.12em] text-amber-50 disabled:opacity-60">{saving ? "SAVING…" : record ? "SAVE CHANGES" : "SAVE RECORD"}</button></div>
      </form>
    </section>
  </main>;
}
