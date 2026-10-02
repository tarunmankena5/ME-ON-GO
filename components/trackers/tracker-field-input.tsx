"use client";

import { formatDuration } from "@/lib/data/tracker-validation";
import type { TrackerField, TrackerValue } from "@/types/tracker";

export const trackerInputClass = "mt-2 min-h-12 w-full border-b border-white/15 bg-transparent px-0 py-3 text-base text-stone-100 outline-none transition-colors placeholder:text-stone-700 focus:border-amber-100/60 focus-visible:ring-2 focus-visible:ring-amber-100/30";

export function initialFieldInput(field: TrackerField, value: TrackerValue | undefined): string | boolean {
  if (field.type === "BOOLEAN") return typeof value === "boolean" ? value : false;
  if (field.type === "DURATION") return typeof value === "number" ? formatDuration(value) : "";
  return value === undefined ? "" : String(value);
}

export function TrackerFieldInputControl({ field, value, onChange, idPrefix = "field" }: {
  field: TrackerField;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
  idPrefix?: string;
}) {
  const id = `${idPrefix}-${field.id}`;
  const suffix = field.unit ? ` · ${field.unit}` : "";
  const label = <label htmlFor={id} className="text-sm text-stone-400">{field.name}{suffix}{field.required && <span className="ml-1 text-amber-100/70">*</span>}</label>;
  if (field.type === "BOOLEAN") return <label className="flex min-h-12 items-center gap-3 text-sm text-stone-300"><input id={id} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-amber-100"/>{field.name}{field.required && <span className="text-amber-100/70">*</span>}</label>;
  if (field.type === "NOTES") return <div>{label}<textarea id={id} rows={4} maxLength={4000} value={String(value)} onChange={(event) => onChange(event.target.value)} className={`${trackerInputClass} min-h-28 resize-y`} /></div>;
  if (field.type === "SELECT") return <div>{label}<select id={id} value={String(value)} onChange={(event) => onChange(event.target.value)} className={trackerInputClass}><option value="">Choose…</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>;
  if (field.type === "RATING") return <fieldset><legend className="text-sm text-stone-400">{field.name}{field.required && <span className="ml-1 text-amber-100/70">*</span>}</legend><div className="mt-2 flex gap-2" role="group" aria-label={`${field.name} rating from 1 to 5`}>{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" aria-label={`${rating} of 5`} aria-pressed={String(value) === String(rating)} onClick={() => onChange(String(rating))} className={`min-h-11 min-w-11 border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 ${String(value) === String(rating) ? "border-amber-100/50 text-amber-50" : "border-white/10 text-stone-500 hover:text-stone-200"}`}>{rating}</button>)}</div></fieldset>;
  const type = field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : field.type === "TIME" ? "time" : "text";
  return <div>{label}<input id={id} name={field.name} type={type} inputMode={field.type === "NUMBER" ? "decimal" : field.type === "DURATION" ? "numeric" : undefined} step={field.type === "NUMBER" ? "any" : undefined} placeholder={field.type === "DURATION" ? "mm:ss or hh:mm:ss" : undefined} value={String(value)} onChange={(event) => onChange(event.target.value)} className={trackerInputClass}/>{field.type === "DURATION" && <p className="mt-1 text-xs text-stone-600">Use mm:ss or hh:mm:ss.</p>}</div>;
}
