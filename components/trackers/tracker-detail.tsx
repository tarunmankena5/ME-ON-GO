"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createTrackerRepository } from "@/lib/data/create-tracker-repository";
import { formatDuration } from "@/lib/data/tracker-validation";
import { formatDateKey } from "@/lib/dates/time-zone";
import type { TrackerDefinition, TrackerField, TrackerRecord, TrackerValue } from "@/types/tracker";

function showValue(field: TrackerField, value: TrackerValue | undefined): string {
  if (value === undefined) return "";
  switch (field.type) {
    case "DURATION": return formatDuration(Number(value));
    case "BOOLEAN": return value ? "Yes" : "No";
    case "DATE": return formatDateKey(String(value), { month: "long", day: "numeric", year: "numeric" });
    case "RATING": return `${value} of 5`;
    case "NUMBER": return `${value}${field.unit ? ` ${field.unit}` : ""}`;
    case "TIME": return String(value);
    default: return String(value);
  }
}

function preview(record: TrackerRecord, tracker: TrackerDefinition): string {
  const values = tracker.fields.filter((field) => field.active && Object.hasOwn(record.values, field.id)).slice(0, 2)
    .map((field) => showValue(field, record.values[field.id]));
  return values.join(" · ");
}

export function TrackerDetail({ trackerId }: { trackerId: string }) {
  const router = useRouter();
  const repository = useMemo(() => createTrackerRepository(), []);
  const [tracker, setTracker] = useState<TrackerDefinition | null>(null);
  const [records, setRecords] = useState<TrackerRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void repository.findTracker(trackerId).then(async (found) => {
      if (!found) { if (!cancelled) setStatus("not-found"); return; }
      const history = await repository.listRecords(found.id);
      if (!cancelled) { setTracker(found); setRecords(history); setStatus("ready"); }
    }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, [repository, trackerId]);

  async function removeTracker() {
    try { await repository.deleteTracker(trackerId); router.replace("/trackers"); router.refresh(); }
    catch { setError("This tracker couldn’t be deleted. Please try again."); setConfirmDelete(false); }
  }

  if (status === "loading") return <main className="mx-auto max-w-3xl px-6 pt-16 text-sm text-stone-500">Loading tracker…</main>;
  if (status === "error") return <main className="mx-auto max-w-3xl px-6 pt-16"><p role="alert" className="text-sm text-red-200/90">This tracker couldn’t be loaded.</p><Link className="mt-6 inline-flex min-h-11 items-center text-amber-100" href="/trackers">Back to trackers</Link></main>;
  if (status === "not-found" || !tracker) return <main className="mx-auto max-w-3xl px-6 pt-16"><h1 className="text-3xl text-stone-100">Tracker not found</h1><p className="mt-3 text-stone-500">It may have been removed or the link may be out of date.</p><Link className="mt-6 inline-flex min-h-11 items-center text-amber-100" href="/trackers">Back to trackers</Link></main>;

  const activeFields = tracker.fields.filter((field) => field.active).sort((a, b) => a.position - b.position);
  const months = new Map<string, TrackerRecord[]>();
  for (const record of records) {
    const monthKey = record.occurredOn.slice(0, 7);
    months.set(monthKey, [...(months.get(monthKey) ?? []), record]);
  }
  return <main className="mx-auto min-h-dvh w-full max-w-3xl px-6 pb-[max(7rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-10">
    <header className="flex min-h-14 items-center justify-between border-b border-white/[0.08]"><Link href="/trackers" className="inline-flex min-h-11 items-center text-xs tracking-[0.2em] text-stone-200">ME ON GO</Link><Link href={`/trackers/${tracker.id}/edit`} className="inline-flex min-h-11 items-center px-2 text-sm text-stone-400 hover:text-amber-100 focus-visible:outline-2 focus-visible:outline-amber-200">Edit tracker</Link></header>
    <section className="pt-10 sm:pt-14"><p className="text-xs uppercase tracking-[0.24em] text-amber-100/70">Tracker</p><h1 className="mt-4 break-words text-4xl font-medium tracking-[-0.055em] text-stone-100 sm:text-5xl">{tracker.name}</h1>{tracker.description && <p className="mt-4 max-w-xl whitespace-pre-wrap text-sm leading-6 text-stone-500">{tracker.description}</p>}
      <div className="mt-8"><h2 className="text-[10px] font-medium uppercase tracking-[0.22em] text-stone-600">FIELDS</h2>{activeFields.length === 0 ? <p className="mt-4 text-sm text-stone-600">No active fields. Edit this tracker to add one.</p> : <dl className="mt-3 divide-y divide-white/[0.07] border-y border-white/[0.08]">{activeFields.map((field) => <div key={field.id} className="flex min-h-14 items-center justify-between gap-3 py-3"><dt className="break-words text-sm text-stone-200">{field.name}</dt><dd className="shrink-0 text-xs text-stone-500">{field.type === "SELECT" ? `Select · ${field.options.length} options` : field.type === "RATING" ? "Rating · 1–5" : `${field.type[0]}${field.type.slice(1).toLowerCase()}${field.unit ? ` · ${field.unit}` : ""}`}{field.required && <span className="ml-2 text-amber-100/70">Required</span>}</dd></div>)}</dl>}</div>
      <Link href={`/trackers/${tracker.id}/records/new`} className="mt-8 flex min-h-14 w-full items-center justify-center border border-amber-100/35 text-sm font-medium tracking-[0.12em] text-amber-50 transition-colors hover:border-amber-100/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">ADD RECORD</Link>
    </section>
    <section className="mt-12"><h2 className="text-[10px] font-medium uppercase tracking-[0.22em] text-stone-600">RECORD HISTORY {records.length > 0 && <span className="ml-2 font-normal text-stone-500">· {records.length} {records.length === 1 ? "RECORD" : "RECORDS"}</span>}</h2>{records.length === 0 ? <p className="mt-5 text-sm text-stone-600">Records you add will appear here.</p> : <div className="mt-5 space-y-8">{[...months.entries()].map(([monthKey, monthRecords]) => <section key={monthKey}><h3 className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">{formatDateKey(`${monthKey}-01`, { month: "long", year: "numeric" })}</h3><div className="mt-3 divide-y divide-white/[0.07] border-y border-white/[0.08]">{monthRecords.map((record) => { const date = formatDateKey(record.occurredOn, { month: "long", day: "numeric" }); const time = record.occurredAt ? new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(record.occurredAt)) : "Date only"; const summary = preview(record, tracker); return <Link key={record.id} href={`/trackers/${tracker.id}/records/${record.id}`} aria-label={`${tracker.name} record from ${date}, ${time}${summary ? ` · ${summary}` : ""}`} className="block min-h-20 py-4 focus-visible:outline-2 focus-visible:outline-amber-200"><div className="flex items-baseline justify-between gap-3"><span className="text-sm text-stone-200">{date}</span><span className="shrink-0 text-xs text-stone-600">{time}</span></div>{summary && <p className="mt-2 break-words text-sm text-stone-500">{summary}</p>}</Link>; })}</div></section>)}</div>}</section>
    <div className="mt-14 border-t border-white/[0.08] pt-5">{error && <p role="alert" className="mb-3 text-sm text-red-200/80">{error}</p>}<button type="button" onClick={() => setConfirmDelete(true)} className="min-h-11 px-1 text-sm text-stone-600 transition-colors hover:text-red-200 focus-visible:outline-2 focus-visible:outline-red-200">Delete tracker</button></div>
    {confirmDelete && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"><section role="alertdialog" aria-modal="true" aria-labelledby="delete-tracker-title" aria-describedby="delete-tracker-description" className="w-full max-w-md border border-white/10 bg-[#111214] p-6"><p className="text-[10px] uppercase tracking-[0.2em] text-red-200/70">Delete tracker</p><h2 id="delete-tracker-title" className="mt-3 break-words text-xl font-medium text-stone-100">Delete “{tracker.name}”?</h2><p id="delete-tracker-description" className="mt-2 text-sm leading-6 text-stone-400">This permanently removes this tracker and all {records.length} {records.length === 1 ? "record" : "records"} saved with it.</p><div className="mt-6 flex justify-end gap-3"><button type="button" autoFocus onClick={() => setConfirmDelete(false)} className="min-h-11 px-4 text-sm text-stone-400">Keep tracker</button><button type="button" onClick={() => void removeTracker()} className="min-h-11 bg-red-200/10 px-4 text-sm text-red-100">Delete tracker</button></div></section></div>}
  </main>;
}
