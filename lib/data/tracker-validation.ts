import { TRACKER_FIELD_TYPES, type NewTrackerDefinition, type TrackerDefinition, type TrackerFieldInput, type TrackerRecord, type TrackerValues } from "@/types/tracker";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDateKey(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
}

export function parseDuration(value: string): number | null {
  const match = /^(?:(\d{1,3}):)?([0-5]?\d):([0-5]\d)$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (!match[1] && !value.includes(":")) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatDuration(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainder = wholeSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function validateTrackerDefinition(input: NewTrackerDefinition): string | null {
  const name = input.name.trim();
  if (!name) return "Add a tracker name to continue.";
  if (name.length > 100) return "Tracker names can be up to 100 characters.";
  if (input.description && input.description.trim().length > 500) return "Descriptions can be up to 500 characters.";
  if (input.fields.length === 0) return "Add at least one field.";
  const names = new Set<string>();
  for (const field of input.fields) {
    const fieldName = field.name.trim();
    if (!fieldName) return "Every field needs a name.";
    if (fieldName.length > 80) return "Field names can be up to 80 characters.";
    const key = fieldName.toLocaleLowerCase();
    if (names.has(key)) return `“${fieldName}” is already a field. Choose a unique name.`;
    names.add(key);
    if (!TRACKER_FIELD_TYPES.includes(field.type)) return "Choose a supported field type.";
    if (field.unit && field.unit.trim().length > 24) return "Units can be up to 24 characters.";
    if (field.type === "SELECT") {
      const options = field.options.map((option) => option.trim());
      if (options.length < 2 || options.some((option) => !option)) return `${fieldName} needs at least two non-empty options.`;
      if (options.some((option) => option.length > 80)) return `Options for ${fieldName} can be up to 80 characters.`;
      if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== options.length) return `Options for ${fieldName} must be unique.`;
    }
  }
  return null;
}

export function validateTrackerValues(
  fields: TrackerFieldInput[] | TrackerDefinition["fields"],
  values: TrackerValues,
  allowInactiveValueIds: readonly string[] = [],
): string | null {
  const byId = new Map(fields.map((field) => [field.id ?? "", field]));
  for (const key of Object.keys(values)) {
    const field = byId.get(key);
    if (!field || (!field.active && !allowInactiveValueIds.includes(key))) return "A record contains a field that is no longer available.";
  }
  for (const field of fields) {
    if (!field.active) {
      if (allowInactiveValueIds.includes(field.id ?? "")) continue;
      continue;
    }
    const value = values[field.id ?? ""];
    if (value === undefined || value === null || value === "") {
      if (field.required) return `${field.name} is required.`;
      continue;
    }
    switch (field.type) {
      case "TEXT":
        if (typeof value !== "string" || value.length > 500) return `${field.name} must be text up to 500 characters.`;
        break;
      case "NOTES":
        if (typeof value !== "string" || value.length > 4000) return `${field.name} must be notes up to 4,000 characters.`;
        break;
      case "NUMBER":
        if (typeof value !== "number" || !Number.isFinite(value)) return `${field.name} must be a valid number.`;
        break;
      case "DURATION":
        if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 359999) return `${field.name} must be a valid duration.`;
        break;
      case "DATE":
        if (typeof value !== "string" || !isValidDateKey(value)) return `${field.name} must be a valid date.`;
        break;
      case "TIME":
        if (typeof value !== "string" || !TIME_RE.test(value)) return `${field.name} must be a valid time.`;
        break;
      case "RATING":
        if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) return `${field.name} must be rated from 1 to 5.`;
        break;
      case "BOOLEAN":
        if (typeof value !== "boolean") return `${field.name} must be true or false.`;
        break;
      case "SELECT":
        if (typeof value !== "string" || !field.options.includes(value)) return `Choose one of the options for ${field.name}.`;
        break;
    }
  }
  return null;
}

export function validateTrackerRecord(tracker: TrackerDefinition, record: Pick<TrackerRecord, "occurredOn" | "occurredAt" | "values">, allowInactiveValueIds: readonly string[] = []): string | null {
  if (!isValidDateKey(record.occurredOn)) return "Choose a valid record date.";
  if (record.occurredAt !== null && (Number.isNaN(Date.parse(record.occurredAt)) || !record.occurredAt.includes("T"))) return "Choose a valid record time.";
  return validateTrackerValues(tracker.fields, record.values, allowInactiveValueIds);
}

export function normalizeField(field: TrackerFieldInput, position: number): TrackerFieldInput {
  return {
    ...field,
    name: field.name.trim(),
    unit: field.unit?.trim() || null,
    required: Boolean(field.required),
    position,
    active: field.active ?? true,
    options: field.type === "SELECT" ? field.options.map((option) => option.trim()).filter(Boolean) : [],
  };
}
