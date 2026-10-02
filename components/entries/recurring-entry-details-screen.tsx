"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createRecurringEntryRepository } from "@/lib/data/create-recurring-entry-repository";
import { formatDateKey } from "@/lib/dates/time-zone";
import { getRecurringOccurrence, type RecurringEntry } from "@/types/recurring-entry";

export function RecurringEntryDetailsScreen({ id }: { id: string }) {
  const router = useRouter();
  const repository = useMemo(() => createRecurringEntryRepository(), []);
  const [entry, setEntry] = useState<RecurringEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void repository.findById(id).then((value) => { if (!cancelled) { setEntry(value); setLoading(false); } }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, repository]);
  async function remove() {
    try { await repository.delete(id); router.replace("/calendar"); router.refresh(); }
    catch { setError("This date couldn’t be deleted. Please try again."); setConfirmDelete(false); }
  }
  const occurrence = entry ? getRecurringOccurrence(entry, new Date().getFullYear()) : null;
  if (loading) return <main className="mx-auto max-w-3xl px-6 pt-16 text-sm text-stone-500">Loading recurring date…</main>;
  if (!entry || !occurrence) return <main className="mx-auto max-w-3xl px-6 pt-16"><p className="text-xs uppercase tracking-[0.2em] text-stone-500">ME ON GO</p><h1 className="mt-8 text-4xl text-stone-100">Date not found</h1><p className="mt-3 text-stone-500">This recurring date may have been removed.</p><Link className="mt-6 inline-flex min-h-11 items-center text-amber-100" href="/">Back to Today</Link></main>;
  const dateLabel = formatDateKey(occurrence.occurrenceDate, { month: "long", day: "numeric" });
  return <main className="mx-auto min-h-dvh w-full max-w-3xl px-6 pb-32 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-10">
    <header className="flex min-h-14 items-center justify-between border-b border-white/[0.08]"><Link href="/calendar" className="inline-flex min-h-11 items-center text-xs tracking-[0.2em] text-stone-200">ME ON GO</Link><Link href={`/recurring/${id}/edit`} className="inline-flex min-h-11 items-center px-2 text-sm text-stone-400 hover:text-amber-100">Edit</Link></header>
    <section className="pt-12 sm:pt-16"><p className="text-xs uppercase tracking-[0.24em] text-amber-100/70">{entry.kind === "BIRTHDAY" ? "Birthday" : "Anniversary"} · Every year</p><h1 className="mt-4 break-words text-4xl font-medium tracking-[-0.055em] text-stone-100 sm:text-5xl">{entry.title}</h1><p className="mt-5 text-lg text-stone-400">{dateLabel}</p>{occurrence.yearsSince !== null && <p className="mt-2 text-sm text-stone-500">{entry.kind === "BIRTHDAY" ? `${occurrence.yearsSince} years old this year` : `${occurrence.yearsSince} years`}</p>}{entry.notes && <p className="mt-8 whitespace-pre-wrap border-t border-white/[0.08] pt-5 text-sm leading-6 text-stone-400">{entry.notes}</p>}</section>
    {error && <p role="alert" className="mt-8 text-sm text-red-200/80">{error}</p>}
    <button type="button" onClick={() => setConfirmDelete(true)} className="mt-14 min-h-11 text-sm text-red-200/60 hover:text-red-200 focus-visible:outline-2 focus-visible:outline-red-200">Delete recurring date</button>
    {confirmDelete && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"><section role="alertdialog" aria-modal="true" aria-labelledby="delete-recurring-title" aria-describedby="delete-recurring-description" className="w-full max-w-md border border-white/10 bg-[#111214] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"><p className="text-[10px] uppercase tracking-[0.2em] text-red-200/70">Delete recurring date</p><h2 id="delete-recurring-title" className="mt-3 text-xl font-medium text-stone-100">Delete {entry.title}?</h2><p id="delete-recurring-description" className="mt-2 text-sm leading-6 text-stone-400">This removes the source date and its future yearly appearances.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setConfirmDelete(false)} className="min-h-11 px-4 text-sm text-stone-400">Keep date</button><button type="button" onClick={() => void remove()} className="min-h-11 bg-red-200/10 px-4 text-sm text-red-100">Delete</button></div></section></div>}
  </main>;
}
