import type { NewRecurringEntry, RecurringEntry, RecurringEntryChanges } from "@/types/recurring-entry";
import { isValidRecurringDate } from "@/types/recurring-entry";
import type { RecurringEntryRepository } from "@/lib/data/recurring-entry-repository";

const STORAGE_KEY = "meongo.demo.recurring-entries.v1";
const LOCAL_DEMO_USER_ID = "local-demo";

function storage(): Storage {
  if (typeof window === "undefined") throw new Error("Local demo recurring entries are only available in the browser.");
  return window.localStorage;
}

function validRecord(value: unknown): value is RecurringEntry {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RecurringEntry>;
  return typeof item.id === "string" && typeof item.userId === "string" &&
    (item.kind === "BIRTHDAY" || item.kind === "ANNIVERSARY") && typeof item.title === "string" &&
    typeof item.month === "number" && typeof item.day === "number" && isValidRecurringDate(item.month, item.day) &&
    (item.year === null || (typeof item.year === "number" && Number.isInteger(item.year))) &&
    (item.notes === null || typeof item.notes === "string") && item.recurrence === "YEARLY" &&
    typeof item.createdAt === "string" && typeof item.updatedAt === "string";
}

function read(): RecurringEntry[] {
  const raw = storage().getItem(STORAGE_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(validRecord)) throw new Error("Invalid data");
    return parsed;
  } catch {
    throw new Error("Recurring demo entries could not be read. Clear this device’s ME ON GO demo data to continue.");
  }
}

function write(entries: RecurringEntry[]) { storage().setItem(STORAGE_KEY, JSON.stringify(entries)); }

export class LocalDemoRecurringEntryRepository implements RecurringEntryRepository {
  async listAll() { return read().sort((a, b) => a.month - b.month || a.day - b.day || a.title.localeCompare(b.title)); }
  async findById(id: string) { return read().find((entry) => entry.id === id) ?? null; }
  async create(input: NewRecurringEntry) {
    validate(input);
    const now = new Date().toISOString();
    const entry: RecurringEntry = { ...input, id: crypto.randomUUID(), userId: LOCAL_DEMO_USER_ID, createdAt: now, updatedAt: now };
    write([...read(), entry]);
    return entry;
  }
  async update(id: string, changes: RecurringEntryChanges) {
    const entries = read();
    const current = entries.find((entry) => entry.id === id);
    if (!current) throw new Error("Recurring entry not found on this device.");
    const updated = { ...current, ...changes, updatedAt: new Date().toISOString() };
    validate(updated);
    write(entries.map((entry) => entry.id === id ? updated : entry));
    return updated;
  }
  async delete(id: string) { write(read().filter((entry) => entry.id !== id)); }
}

function validate(entry: NewRecurringEntry | RecurringEntry) {
  if (!entry.title.trim() || entry.title.trim().length > 200) throw new Error("Add a name or title to continue.");
  if (!isValidRecurringDate(entry.month, entry.day)) throw new Error("Choose a valid date.");
  if (entry.year !== null && (!Number.isInteger(entry.year) || entry.year < 1 || entry.year > 9999)) throw new Error("Choose a valid year.");
  if (entry.kind === "BIRTHDAY" && entry.year !== null && entry.year > new Date().getFullYear()) throw new Error("Birth year cannot be in the future.");
}
