"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createTrackerRepository } from "@/lib/data/create-tracker-repository";
import { formatDateKey } from "@/lib/dates/time-zone";
import { TRACKER_TEMPLATES } from "@/lib/trackers/templates";
import type { TrackerDefinition } from "@/types/tracker";

type TrackerSummary = TrackerDefinition & {
  recordCount: number;
  lastRecordDate: string | null;
};

export function TrackerDirectory() {
  const repository = useMemo(() => createTrackerRepository(), []);
  const [trackers, setTrackers] = useState<TrackerSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  
  useEffect(() => {
    let cancelled = false;
    void repository.listTrackers().then(async (rows) => {
      if (cancelled) return;
      const summaries = await Promise.all(rows.map(async (tracker) => {
        const records = await repository.listRecords(tracker.id);
        const lastRecordDate = records.length > 0 ? records[0].occurredOn : null;
        return { ...tracker, recordCount: records.length, lastRecordDate };
      }));
      if (!cancelled) {
        setTrackers(summaries);
        setStatus("ready");
      }
    }).catch(() => {
      if (!cancelled) setStatus("error");
    });
    return () => { cancelled = true; };
  }, [repository]);

  return <main className="mx-auto min-h-dvh w-full max-w-3xl px-6 pb-[max(7rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-10">
    <header className="flex items-center justify-between border-b border-white/[0.08] pb-4">
      <Link href="/" aria-label="ME ON GO Today" className="inline-flex min-h-11 items-center text-xs font-medium tracking-[0.2em] text-stone-200 transition-colors hover:text-amber-100">ME ON GO</Link>
      <span className="text-[10px] uppercase tracking-[0.2em] text-stone-600">Trackers</span>
    </header>
    <section className="pt-10 sm:pt-14"><p className="text-xs uppercase tracking-[0.24em] text-amber-100/70">Track something</p><h1 className="mt-4 text-4xl font-medium tracking-[-0.055em] text-stone-100 sm:text-5xl">Your trackers</h1><p className="mt-4 max-w-xl text-sm leading-6 text-stone-500">Build a tracker for anything you want to record repeatedly. Templates are editable starting points.</p>
      <Link href="/trackers/new" className="mt-8 flex min-h-16 items-center justify-between border-y border-amber-100/20 px-1 text-sm text-amber-50 transition-colors hover:border-amber-100/50 focus-visible:outline-2 focus-visible:outline-amber-200"><span>Create from scratch</span><span aria-hidden="true" className="text-xl font-light text-amber-100">+</span></Link>
    </section>
    <section className="mt-10"><h2 className="text-[10px] font-medium uppercase tracking-[0.22em] text-stone-600">START WITH A TEMPLATE</h2><div className="mt-3 divide-y divide-white/[0.07] border-y border-white/[0.08]">{TRACKER_TEMPLATES.map((template) => <Link key={template.id} href={`/trackers/new?template=${template.id}`} className="flex min-h-16 items-center justify-between gap-3 text-sm text-stone-300 transition-colors hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-amber-200"><span className="break-words">{template.name}</span><span className="shrink-0 text-stone-600">{template.fields.length} fields</span></Link>)}</div></section>
    <section className="mt-12"><h2 className="text-[10px] font-medium uppercase tracking-[0.22em] text-stone-600">YOUR TRACKERS</h2>{status === "loading" ? <p className="mt-5 text-sm text-stone-600">Loading trackers…</p> : status === "error" ? <p role="alert" className="mt-5 text-sm text-red-200/80">Trackers couldn’t be loaded. Please try again.</p> : trackers.length === 0 ? <p className="mt-5 text-sm text-stone-600">Your trackers will appear here.</p> : <div className="mt-3 divide-y divide-white/[0.07] border-y border-white/[0.08]">{trackers.map((tracker) => <Link key={tracker.id} href={`/trackers/${tracker.id}`} className="block min-h-24 py-4 transition-colors hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-amber-200"><span className="block break-words text-lg text-stone-200">{tracker.name}</span>{tracker.description && <span className="mt-1 block truncate text-sm text-stone-500">{tracker.description}</span>}<span className="mt-2 block flex items-center gap-2 text-xs text-stone-600"><span>{tracker.recordCount} {tracker.recordCount === 1 ? "record" : "records"}</span>{tracker.lastRecordDate && <><span aria-hidden="true">·</span><span>Last: {formatDateKey(tracker.lastRecordDate, { month: "short", day: "numeric", year: "numeric" })}</span></>}</span></Link>)}</div>}</section>
  </main>;
}
