import type { Entry, EntryChanges, NewEntry } from "@/types/entry";
import type { EntryRepository } from "@/lib/data/entry-repository";
import { isTaskOverdue } from "@/lib/dates/task-state";

const STORAGE_KEY = "lifelog.demo.entries.v1";
const LOCAL_DEMO_USER_ID = "local-demo";

function getStorage(): Storage {
  if (typeof window === "undefined") {
    throw new Error("Local demo entries are only available in the browser.");
  }

  return window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isEntry(value: unknown): value is Entry {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== "string" ||
    typeof value.userId !== "string" ||
    typeof value.title !== "string" ||
    !(value.notes === null || typeof value.notes === "string") ||
    !isRecord(value.metadata) ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return false;
  }

  if (value.kind === "ACTIVITY") {
    return (
      typeof value.occurredAt === "string" &&
      (value.activityType === null || typeof value.activityType === "string")
    );
  }
  if (value.kind === "TASK") {
    return (
      isNullableString(value.dueAt) &&
      (value.priority === "LOW" || value.priority === "NORMAL" || value.priority === "HIGH") &&
      (value.category === undefined || value.category === null || typeof value.category === "string" && value.category.trim().length > 0 && value.category.length <= 80) &&
      isNullableString(value.completedAt)
    );
  }
  if (value.kind === "EVENT") {
    return typeof value.startsAt === "string" && isNullableString(value.endsAt);
  }
  return false;
}

function readEntries(): Entry[] {
  const serialized = getStorage().getItem(STORAGE_KEY);
  if (serialized === null) return [];

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed) || !parsed.every(isEntry)) {
      throw new Error("Invalid local demo data.");
    }
    return parsed.map((entry) => entry.kind === "TASK" ? { ...entry, category: entry.category ?? null } : entry);
  } catch {
    throw new Error("Local demo entries could not be read. Clear this device's ME ON GO demo data to continue.");
  }
}

function writeEntries(entries: Entry[]): void {
  getStorage().setItem(STORAGE_KEY, JSON.stringify(entries));
}

function entryDate(entry: Entry): string | null {
  switch (entry.kind) {
    case "ACTIVITY":
      return entry.occurredAt;
    case "TASK":
      return entry.dueAt;
    case "EVENT":
      return entry.startsAt;
  }
}

function dateKey(value: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const fields = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function sortByDateAscending(left: Entry, right: Entry): number {
  return new Date(entryDate(left) ?? left.createdAt).valueOf() - new Date(entryDate(right) ?? right.createdAt).valueOf();
}

export class LocalDemoEntryRepository implements EntryRepository {
  async findById(id: string): Promise<Entry | null> {
    return readEntries().find((entry) => entry.id === id) ?? null;
  }

  async listForDate(date: string, timeZone: string): Promise<Entry[]> {
    return readEntries()
      .filter((entry) => {
        const value = entryDate(entry);
        return value !== null && dateKey(value, timeZone) === date;
      })
      .sort(sortByDateAscending);
  }

  async listForDateRange(startDate: string, endDate: string, timeZone: string): Promise<Entry[]> {
    return readEntries()
      .filter((entry) => {
        const value = entryDate(entry);
        if (value === null) return false;
        const day = dateKey(value, timeZone);
        return day >= startDate && day < endDate;
      })
      .sort(sortByDateAscending);
  }

  async listUpcoming(from: string, timeZone: string): Promise<Entry[]> {
    return readEntries()
      .filter((entry) => {
        if (entry.kind === "ACTIVITY") return false;
        if (entry.kind === "TASK" && entry.completedAt !== null) return false;
        const value = entryDate(entry);
        if (value === null) return entry.kind === "TASK";
        return dateKey(value, timeZone) >= from;
      })
      .sort(sortByDateAscending);
  }

  async listTodayOverview(today: string, now: string, timeZone: string) {
    const entries = readEntries();
    const tomorrow = new Date(`${today}T00:00:00.000Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowKey = tomorrow.toISOString().slice(0, 10);
    const currentTime = new Date(now);
    const todayEntries = entries.filter((entry) => {
      const value = entryDate(entry);
      return value !== null && dateKey(value, timeZone) === today;
    });
    const overdueTasks = entries.filter((entry): entry is Extract<Entry, { kind: "TASK" }> =>
      entry.kind === "TASK" && isTaskOverdue(entry, currentTime, timeZone),
    );
    const upcoming = entries.filter((entry) => {
      if (entry.kind === "ACTIVITY") return false;
      if (entry.kind === "TASK" && entry.completedAt !== null) return false;
      const value = entryDate(entry);
      if (value === null) return entry.kind === "TASK";
      return dateKey(value, timeZone) >= tomorrowKey;
    }).sort(sortByDateAscending);
    return { today: todayEntries.sort(sortByDateAscending), overdueTasks: overdueTasks.sort(sortByDateAscending), upcoming };
  }

  async create(input: NewEntry): Promise<Entry> {
    if (input.kind === "TASK" && input.category !== null && (!input.category.trim() || input.category.length > 80)) {
      throw new Error("Category must be between 1 and 80 characters.");
    }
    const now = new Date().toISOString();
    const entry = {
      ...input,
      id: crypto.randomUUID(),
      userId: LOCAL_DEMO_USER_ID,
      createdAt: now,
      updatedAt: now,
    } as Entry;
    writeEntries([...readEntries(), entry]);
    return entry;
  }

  async update(id: string, changes: EntryChanges): Promise<Entry> {
    const entries = readEntries();
    const current = entries.find((entry) => entry.id === id);
    if (!current) throw new Error("Entry not found on this device.");

    const allowedFields = new Set([
      "title",
      "notes",
      "metadata",
      ...(current.kind === "ACTIVITY"
        ? ["activityType", "occurredAt"]
        : current.kind === "TASK"
          ? ["dueAt", "priority", "category", "completedAt"]
          : ["startsAt", "endsAt"]),
    ]);
    if (Object.keys(changes).some((field) => !allowedFields.has(field))) {
      throw new Error("Those changes do not match this entry type.");
    }
    if (current.kind === "TASK" && "category" in changes && changes.category !== null && changes.category !== undefined && (!changes.category.trim() || changes.category.length > 80)) {
      throw new Error("Category must be between 1 and 80 characters.");
    }

    const updated = { ...current, ...changes, updatedAt: new Date().toISOString() } as Entry;
    writeEntries(entries.map((entry) => (entry.id === id ? updated : entry)));
    return updated;
  }

  async delete(id: string): Promise<void> {
    writeEntries(readEntries().filter((entry) => entry.id !== id));
  }
}
