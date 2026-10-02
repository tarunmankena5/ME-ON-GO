"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createTrackerRepository } from "@/lib/data/create-tracker-repository";
import { formatDateKey, formatInTimeZone, getDeviceTimeZone } from "@/lib/dates/time-zone";
import { formatDuration } from "@/lib/data/tracker-validation";
import type { TrackerDefinition, TrackerField, TrackerRecord, TrackerValue } from "@/types/tracker";

function formatted(field: TrackerField, value: TrackerValue | undefined): string {
  if (value === undefined) return "";
  if (field.type === "DURATION") return formatDuration(Number(value));
  if (field.type === "BOOLEAN") return value ? "Yes" : "No";
  if (field.type === "DATE") return formatDateKey(String(value), { month: "long", day: "numeric", year: "numeric" });
  if (field.type === "RATING") return `${value} of 5`;
  if (field.type === "NUMBER") return `${value}${field.unit ? ` ${field.unit}` : ""}`;
  return String(value);
}

export function TrackerRecordDetail({ trackerId, recordId }: { trackerId: string; recordId: string }) {
  const router = useRouter();
  const repository = useMemo(() => createTrackerRepository(), []);
  const [tracker, setTracker] = useState<TrackerDefinition | null>(null);
  const [record, setRecord] = useState<TrackerRecord | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void repository.findTracker(trackerId).then(async (found) => {
      if (!found) { if (!cancelled) setStatus("not-found"); return; }
      const item = await repository.findRecord(found.id, recordId);
      if (cancelled) return;
      setTracker(found); setRecord(item); setStatus(item ? "ready" : "not-found");
    }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, [recordId, repository, trackerId]);

  async function remove() {
    try { await repository.deleteRecord(trackerId, recordId); router.replace(`/trackers/${trackerId}`); router.refresh(); }
    catch { setError("This record couldn’t be deleted. Please try again."); setConfirmDelete(false); }
  }

  if (status === "loading") return <main className="mx-auto max-w-3xl px-6 pt-16 text-sm text-stone-500">Loading record…</main>;
  if (status === "error") return <main className="mx-auto max-w-3xl px-6 pt-16"><p role="alert" className="text-sm text-red-200/90">This record couldn’t be loaded.</p><Link className="mt-6 inline-flex min-h-11 items-center text-amber-100" href={`/trackers/${trackerId}`}>Back to tracker</Link></main>;
  if (status === "not-found" || !tracker || !record) return <main className="mx-auto max-w-3xl px-6 pt-16"><h1 className="text-3xl text-stone-100">Record not found</h1><p className="mt-3 text-stone-500">This record may have been removed or the link may be out of date.</p><Link className="mt-6 inline-flex min-h-11 items-center text-amber-100" href={`/trackers/${trackerId}`}>Back to tracker</Link></main>;
  const date = formatDateKey(record.occurredOn, { month: "long", day: "numeric", year: "numeric" });
  const time = record.occurredAt ? formatInTimeZone(record.occurredAt, getDeviceTimeZone(), { hour: "numeric", minute: "2-digit" }) : "Date only";
  const fields = tracker.fields.filter((field) => Object.hasOwn(record.values, field.id)).sort((a, b) => a.position - b.position);
  return <main className="mx-auto min-h-dvh w-full max-w-3xl px-6 pb-[max(7rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-10">
    <header className="flex min-h-14 items-center justify-between border-b border-white/[0.08]"><Link href={`/trackers/${tracker.id}`} className="inline-flex min-h-11 items-center text-xs tracking-[0.2em] text-stone-200">ME ON GO</Link><Link href={`/trackers/${tracker.id}/records/${record.id}/edit`} className="inline-flex min-h-11 items-center px-2 text-sm text-stone-400 hover:text-amber-100 focus-visible:outline-2 focus-visible:outline-amber-200">Edit record</Link></header>
    <section className="pt-10 sm:pt-14"><p className="text-xs uppercase tracking-[0.24em] text-amber-100/70">{tracker.name} record</p><h1 aria-label={`${tracker.name} record from ${date}`} className="mt-4 break-words text-4xl font-medium tracking-[-0.055em] text-stone-100 sm:text-5xl">{date}</h1><p className="mt-3 text-sm text-stone-500">{time}</p>
      {fields.length === 0 ? <p className="mt-9 text-sm text-stone-600">This record has no saved field values.</p> : <dl className="mt-9 divide-y divide-white/[0.07] border-y border-white/[0.08]">{fields.map((field) => <div key={field.id} className="py-5"><dt className="text-xs text-stone-600">{field.name}{!field.active && <span className="ml-2 text-amber-100/60">Inactive field</span>}</dt><dd className="mt-2 break-words whitespace-pre-wrap text-base leading-7 text-stone-200">{formatted(field, record.values[field.id])}</dd></div>)}</dl>}
    </section>
    {error && <p role="alert" className="mt-8 text-sm text-red-200/80">{error}</p>}<button type="button" onClick={() => setConfirmDelete(true)} className="mt-12 min-h-11 text-sm text-stone-600 hover:text-red-200 focus-visible:outline-2 focus-visible:outline-red-200">Delete record</button>
    {confirmDelete && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"><section role="alertdialog" aria-modal="true" aria-labelledby="delete-record-title" aria-describedby="delete-record-description" className="w-full max-w-md border border-white/10 bg-[#111214] p-6"><p className="text-[10px] uppercase tracking-[0.2em] text-red-200/70">Delete record</p><h2 id="delete-record-title" className="mt-3 text-xl font-medium text-stone-100">Delete this {tracker.name} record?</h2><p id="delete-record-description" className="mt-2 text-sm leading-6 text-stone-400">The record from {date}{record.occurredAt ? ` at ${time}` : ""} and its saved values will be removed. The tracker will remain.</p><div className="mt-6 flex justify-end gap-3"><button type="button" autoFocus onClick={() => setConfirmDelete(false)} className="min-h-11 px-4 text-sm text-stone-400">Keep record</button><button type="button" onClick={() => void remove()} className="min-h-11 bg-red-200/10 px-4 text-sm text-red-100">Delete record</button></div></section></div>}
  </main>;
}
