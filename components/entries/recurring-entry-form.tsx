"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createRecurringEntryRepository } from "@/lib/data/create-recurring-entry-repository";
import { isValidRecurringDate, type RecurringEntry, type RecurringEntryKind } from "@/types/recurring-entry";

const fieldClass = "mt-2 min-h-12 w-full border-b border-white/15 bg-transparent px-0 py-3 text-base text-stone-100 outline-none placeholder:text-stone-700 focus:border-amber-100/60 focus-visible:ring-2 focus-visible:ring-amber-100/30";
const monthOptions = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function RecurringEntryForm({ kind: initialKind, entryId }: { kind?: RecurringEntryKind; entryId?: string }) {
  const router = useRouter();
  const repository = useMemo(() => createRecurringEntryRepository(), []);
  const [entry, setEntry] = useState<RecurringEntry | null>(null);
  const [kind, setKind] = useState<RecurringEntryKind | null>(initialKind ?? null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [year, setYear] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "not-found">(entryId ? "loading" : "ready");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedMonth = Number(date.slice(0, 2)) || 0;
  const selectedDay = Number(date.slice(3, 5)) || 0;
  const daysInMonth = selectedMonth ? new Date(Date.UTC(2000, selectedMonth, 0)).getUTCDate() : 31;

  useEffect(() => {
    if (!entryId) return;
    let cancelled = false;
    void repository.findById(entryId).then((found) => {
      if (cancelled) return;
      if (!found) { setStatus("not-found"); return; }
      setEntry(found); setKind(found.kind); setTitle(found.title);
      setDate(`${String(found.month).padStart(2, "0")}-${String(found.day).padStart(2, "0")}`);
      setYear(found.year === null ? "" : String(found.year)); setNotes(found.notes ?? ""); setStatus("ready");
    }).catch(() => { if (!cancelled) { setStatus("not-found"); } });
    return () => { cancelled = true; };
  }, [entryId, repository]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!kind) return;
    const [monthText, dayText] = date.split("-");
    const month = Number(monthText); const day = Number(dayText);
    const parsedYear = year ? Number(year) : null;
    if (!title.trim()) { setError("Add a name or title to continue."); return; }
    if (!isValidRecurringDate(month, day)) { setError("Choose a valid date."); return; }
    if (kind === "ANNIVERSARY" && parsedYear === null) { setError("Choose the original year for this anniversary."); return; }
    if (parsedYear !== null && (!Number.isInteger(parsedYear) || parsedYear < 1 || parsedYear > new Date().getFullYear())) { setError("Choose a valid year that is not in the future."); return; }
    setSaving(true); setError("");
    try {
      const input = { title: title.trim(), month, day, year: parsedYear, notes: notes.trim() || null, recurrence: "YEARLY" as const };
      const saved = entry ? await repository.update(entry.id, input) : await repository.create({ ...input, kind });
      router.replace(`/recurring/${saved.id}`); router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This date couldn’t be saved. Please try again."); setSaving(false);
    }
  }

  if (status === "loading") return <main className="mx-auto max-w-3xl px-6 pt-16 text-sm text-stone-500">Loading recurring date…</main>;
  if (status === "not-found") return <main className="mx-auto max-w-3xl px-6 pt-16"><h1 className="text-3xl text-stone-100">Date not found</h1><Link className="mt-6 inline-flex min-h-11 items-center text-amber-100" href="/">Back to Today</Link></main>;

  return <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 pb-32 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-10">
    <header className="flex min-h-14 items-center justify-between border-b border-white/[0.08]"><Link href={entry ? `/recurring/${entry.id}` : "/add"} className="inline-flex min-h-11 items-center text-xs tracking-[0.2em] text-stone-200">ME ON GO</Link><Link href={entry ? `/recurring/${entry.id}` : "/add"} className="inline-flex min-h-11 items-center text-sm text-stone-500">Cancel</Link></header>
    <section className="pt-12 sm:pt-16">
      <p className="text-xs uppercase tracking-[0.24em] text-amber-100/70">{entry ? "Edit recurring date" : "Add a recurring date"}</p>
      <h1 className="mt-4 text-4xl font-medium tracking-[-0.055em] text-stone-100 sm:text-5xl">{entry ? `Edit ${kind === "BIRTHDAY" ? "birthday" : "anniversary"}` : "A date to remember"}</h1>
      {!entry && <div className="mt-8 flex gap-3" role="group" aria-label="Recurring date type">{(["BIRTHDAY", "ANNIVERSARY"] as const).map((option) => <button key={option} type="button" aria-pressed={kind === option} onClick={() => setKind(option)} className={`min-h-11 border-b px-2 text-xs uppercase tracking-[0.17em] ${kind === option ? "border-amber-100/60 text-amber-100" : "border-white/10 text-stone-500"}`}>{option === "BIRTHDAY" ? "Birthday" : "Anniversary"}</button>)}</div>}
      {kind && <form onSubmit={submit} className="mt-8 space-y-7">
        <div><label htmlFor="recurring-title" className="text-sm text-stone-400">{kind === "BIRTHDAY" ? "Name" : "Name or title"}</label><input id="recurring-title" required maxLength={200} autoComplete="off" className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "BIRTHDAY" ? "Mom" : "Our Anniversary"}/></div>
        <div><span className="text-sm text-stone-400">{kind === "ANNIVERSARY" ? "Original date" : "Birthday"}</span><div className="mt-1 grid grid-cols-2 gap-5"><div><label htmlFor="recurring-month" className="sr-only">Month</label><select id="recurring-month" required className={fieldClass} value={selectedMonth ? String(selectedMonth).padStart(2, "0") : ""} onChange={(event) => { const month = Number(event.target.value); const maxDay = new Date(Date.UTC(2000, month, 0)).getUTCDate(); const day = Math.min(selectedDay, maxDay); setDate(String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0")); }}><option value="">Month</option>{monthOptions.map((month, index) => <option key={month} value={String(index + 1).padStart(2, "0")}>{month}</option>)}</select></div><div><label htmlFor="recurring-day" className="sr-only">Day</label><select id="recurring-day" required className={fieldClass} value={selectedDay ? String(selectedDay).padStart(2, "0") : ""} onChange={(event) => setDate(String(selectedMonth || 1).padStart(2, "0") + "-" + event.target.value)}><option value="">Day</option>{Array.from({ length: daysInMonth }, (_, index) => <option key={index + 1} value={String(index + 1).padStart(2, "0")}>{index + 1}</option>)}</select></div></div><p className="mt-2 text-xs text-stone-600">Repeats every year</p></div>
        <div><label htmlFor="recurring-year" className="text-sm text-stone-400">{kind === "BIRTHDAY" ? "Birth year (optional)" : "Original year"}</label><input id="recurring-year" type="number" inputMode="numeric" min="1" max={new Date().getFullYear()} required={kind === "ANNIVERSARY"} className={fieldClass} value={year} onChange={(e) => setYear(e.target.value)} placeholder={kind === "BIRTHDAY" ? "Optional" : "Year"}/>{kind === "BIRTHDAY" && <p className="mt-2 text-xs text-stone-600">Used only to calculate age for the occurrence.</p>}</div>
        <div><label htmlFor="recurring-notes" className="text-sm text-stone-400">Notes <span className="text-stone-600">(optional)</span></label><textarea id="recurring-notes" rows={3} maxLength={4000} className={fieldClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a note…"/></div>
        {error && <p role="alert" className="text-sm text-red-200/80">{error}</p>}
        <button disabled={saving} className="flex min-h-12 w-full items-center justify-center bg-amber-100 px-5 text-sm font-medium text-[#17130d] transition-colors hover:bg-amber-50 disabled:opacity-50">{saving ? "Saving…" : entry ? "Save changes" : "Save date"}</button>
      </form>}
    </section>
  </main>;
}
