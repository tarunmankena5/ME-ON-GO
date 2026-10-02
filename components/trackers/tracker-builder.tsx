"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createTrackerRepository } from "@/lib/data/create-tracker-repository";
import { validateTrackerDefinition } from "@/lib/data/tracker-validation";
import { TRACKER_TEMPLATES } from "@/lib/trackers/templates";
import { TRACKER_FIELD_TYPES, type TrackerFieldInput, type TrackerFieldType } from "@/types/tracker";

type DraftField = TrackerFieldInput & { draftKey: string };
const inputClass = "mt-2 min-h-12 w-full border-b border-white/15 bg-transparent px-0 py-3 text-base text-stone-100 outline-none transition-colors placeholder:text-stone-700 focus:border-amber-100/60 focus-visible:ring-2 focus-visible:ring-amber-100/30";
const typeLabels: Record<TrackerFieldType, string> = { TEXT: "Text", NUMBER: "Number", DURATION: "Duration", DATE: "Date", TIME: "Time", RATING: "Rating · 1–5", BOOLEAN: "Boolean", SELECT: "Select", NOTES: "Notes" };

function draftFromTemplate(templateId?: string): { name: string; description: string; fields: DraftField[] } {
  const template = TRACKER_TEMPLATES.find((item) => item.id === templateId);
  if (!template) return { name: "", description: "", fields: [] };
  return { name: template.name, description: template.description, fields: template.fields.map((field, position) => ({ ...field, required: field.required, active: true, position, draftKey: `template-field-${position}` })) };
}

function toFieldInput(field: DraftField): TrackerFieldInput {
  const { draftKey, ...input } = field;
  void draftKey;
  return { ...input, options: input.type === "SELECT" ? input.options : [] };
}

export function TrackerBuilder({ trackerId, templateId }: { trackerId?: string; templateId?: string }) {
  const router = useRouter();
  const repository = useMemo(() => createTrackerRepository(), []);
  const [draft, setDraft] = useState(() => draftFromTemplate(templateId));
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "not-found">(trackerId ? "loading" : "ready");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!trackerId) return;
    let cancelled = false;
    void repository.findTracker(trackerId).then(async (tracker) => {
      if (cancelled) return;
      if (!tracker) { setStatus("not-found"); return; }
      const fieldUsage = await repository.getFieldUsage(tracker.id);
      if (cancelled) return;
      setUsage(fieldUsage);
      setDraft({ name: tracker.name, description: tracker.description ?? "", fields: tracker.fields.map((field) => ({ ...field, draftKey: field.id })) });
      setStatus("ready");
    }).catch(() => { if (!cancelled) setStatus("not-found"); });
    return () => { cancelled = true; };
  }, [repository, trackerId]);

  function patchField(key: string, changes: Partial<DraftField>) {
    setDraft((current) => ({ ...current, fields: current.fields.map((field) => field.draftKey === key ? { ...field, ...changes } : field) }));
    setError("");
  }

  function addField() {
    setDraft((current) => ({ ...current, fields: [...current.fields, { draftKey: crypto.randomUUID(), name: "", type: "TEXT", unit: null, required: false, position: current.fields.length, active: true, options: [] }] }));
    setError("");
  }

  function removeField(field: DraftField) {
    if (field.id && (usage[field.id] ?? 0) > 0) {
      patchField(field.draftKey, { active: !field.active });
      return;
    }
    setDraft((current) => ({ ...current, fields: current.fields.filter((item) => item.draftKey !== field.draftKey).map((item, position) => ({ ...item, position })) }));
  }

  function moveField(index: number, by: -1 | 1) {
    const target = index + by;
    if (target < 0 || target >= draft.fields.length) return;
    setDraft((current) => {
      const fields = [...current.fields];
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...current, fields: fields.map((field, position) => ({ ...field, position })) };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { name: draft.name, description: draft.description, fields: draft.fields.map(toFieldInput) };
    const invalid = validateTrackerDefinition(input);
    if (invalid) { setError(invalid); return; }
    setSaving(true); setError("");
    try {
      const saved = trackerId ? await repository.updateTracker(trackerId, input) : await repository.createTracker(input);
      router.replace(`/trackers/${saved.id}`); router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This tracker couldn’t be saved. Please try again."); setSaving(false);
    }
  }

  if (status === "loading") return <main className="mx-auto max-w-3xl px-6 pt-16 text-sm text-stone-500">Loading tracker…</main>;
  if (status === "not-found") return <main className="mx-auto max-w-3xl px-6 pt-16"><h1 className="text-3xl text-stone-100">Tracker not found</h1><Link className="mt-6 inline-flex min-h-11 items-center text-amber-100" href="/trackers">Back to trackers</Link></main>;

  return <main className="mx-auto min-h-dvh w-full max-w-3xl px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-10">
    <header className="flex min-h-14 items-center justify-between border-b border-white/[0.08]"><Link href={trackerId ? `/trackers/${trackerId}` : "/trackers"} className="inline-flex min-h-11 items-center text-xs tracking-[0.2em] text-stone-200">ME ON GO</Link><Link href={trackerId ? `/trackers/${trackerId}` : "/trackers"} className="inline-flex min-h-11 items-center px-2 text-sm text-stone-500">Cancel</Link></header>
    <section className="pt-10 sm:pt-14"><p className="text-xs uppercase tracking-[0.24em] text-amber-100/70">{trackerId ? "Edit tracker" : "Create tracker"}</p><h1 className="mt-4 break-words text-4xl font-medium tracking-[-0.055em] text-stone-100 sm:text-5xl">{trackerId ? "Shape your tracker" : "What do you want to track?"}</h1>
      <form onSubmit={submit} className="mt-8 space-y-8" noValidate>
        <div><label htmlFor="tracker-name" className="text-sm text-stone-400">Name <span className="text-amber-100/70">*</span></label><input id="tracker-name" maxLength={100} autoComplete="off" value={draft.name} onChange={(event) => { setDraft((current) => ({ ...current, name: event.target.value })); setError(""); }} className={inputClass} placeholder="e.g. Reading, Running, or anything else" /></div>
        <div><label htmlFor="tracker-description" className="text-sm text-stone-400">Description <span className="text-stone-600">· optional</span></label><textarea id="tracker-description" rows={2} maxLength={500} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className={`${inputClass} resize-y`} placeholder="A short note about this tracker" /></div>
        <section aria-labelledby="tracker-fields-heading"><div className="flex items-center justify-between gap-3"><h2 id="tracker-fields-heading" className="text-[10px] font-medium uppercase tracking-[0.22em] text-stone-500">FIELDS · {draft.fields.filter((field) => field.active).length} ACTIVE</h2><button type="button" onClick={addField} className="min-h-11 px-2 text-sm text-amber-100 focus-visible:outline-2 focus-visible:outline-amber-200">+ Add field</button></div>
          {draft.fields.length === 0 ? <p className="mt-4 border-y border-white/[0.08] py-5 text-sm text-stone-600">Add at least one field to describe what each record should contain.</p> : <div className="mt-3 space-y-4">{draft.fields.map((field, index) => {
            const used = field.id ? usage[field.id] ?? 0 : 0;
            return <article key={field.draftKey} className={`border-y border-white/[0.08] py-4 ${!field.active ? "opacity-60" : ""}`}><div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-x-4 gap-y-4"><div><label htmlFor={`field-name-${field.draftKey}`} className="text-xs text-stone-500">Field name</label><input id={`field-name-${field.draftKey}`} maxLength={80} value={field.name} onChange={(event) => patchField(field.draftKey, { name: event.target.value })} className={inputClass} placeholder="e.g. Distance" /></div><div><label htmlFor={`field-type-${field.draftKey}`} className="text-xs text-stone-500">Type</label><select id={`field-type-${field.draftKey}`} disabled={used > 0} value={field.type} onChange={(event) => { const type = event.target.value as TrackerFieldType; patchField(field.draftKey, { type, options: type === "SELECT" ? field.options.length ? field.options : ["Option 1", "Option 2"] : [] }); }} className={`${inputClass} disabled:opacity-50`}>{TRACKER_FIELD_TYPES.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></div>
              {field.type === "NUMBER" && <div><label htmlFor={`field-unit-${field.draftKey}`} className="text-xs text-stone-500">Unit · optional</label><input id={`field-unit-${field.draftKey}`} maxLength={24} value={field.unit ?? ""} onChange={(event) => patchField(field.draftKey, { unit: event.target.value || null })} className={inputClass} placeholder="km, kg, pages…" /></div>}
              {field.type === "SELECT" && <div className="col-span-2"><label htmlFor={`field-options-${field.draftKey}`} className="text-xs text-stone-500">Options · one per line</label><textarea id={`field-options-${field.draftKey}`} rows={3} value={field.options.join("\n")} onChange={(event) => patchField(field.draftKey, { options: event.target.value.split("\n") })} className={`${inputClass} resize-y`} placeholder="Great\nGood\nOkay"/><p className="mt-1 text-xs text-stone-600">Existing selections are kept in record history; options already used can’t be removed.</p></div>}
              <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3"><label className="flex min-h-11 items-center gap-2 text-xs text-stone-400"><input type="checkbox" checked={field.required} onChange={(event) => patchField(field.draftKey, { required: event.target.checked })} className="h-4 w-4 accent-amber-100" disabled={!field.active}/>Required</label><div className="flex items-center gap-1"><button type="button" aria-label={`Move ${field.name || "field"} up`} disabled={index === 0} onClick={() => moveField(index, -1)} className="min-h-11 min-w-11 text-stone-400 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-amber-200">↑</button><button type="button" aria-label={`Move ${field.name || "field"} down`} disabled={index === draft.fields.length - 1} onClick={() => moveField(index, 1)} className="min-h-11 min-w-11 text-stone-400 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-amber-200">↓</button><button type="button" onClick={() => removeField(field)} className="min-h-11 px-2 text-xs text-stone-500 hover:text-red-200 focus-visible:outline-2 focus-visible:outline-amber-200">{used > 0 ? field.active ? "Deactivate" : "Reactivate" : "Remove"}</button></div></div>
              {used > 0 && <p className="col-span-2 text-xs text-stone-600">Used in {used} {used === 1 ? "record" : "records"}. Its type and past values are protected.</p>}
              {!field.active && <p className="col-span-2 text-xs text-amber-100/70">Inactive fields stay visible in past records and won’t appear in new records.</p>}
            </div></article>;
          })}</div>}
        </section>
        {error && <p role="alert" className="text-sm text-red-200/90">{error}</p>}
        <div className="sticky bottom-0 -mx-6 bg-gradient-to-t from-[#090a0b] via-[#090a0b] to-transparent px-6 pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:px-0 sm:pb-0"><button type="submit" disabled={saving} className="min-h-14 w-full border border-amber-100/35 px-5 text-sm font-medium tracking-[0.12em] text-amber-50 transition-colors hover:border-amber-100/65 disabled:opacity-60">{saving ? "SAVING…" : trackerId ? "SAVE TRACKER" : "CREATE TRACKER"}</button></div>
      </form>
    </section>
  </main>;
}
