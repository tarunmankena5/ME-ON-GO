import type { NewTrackerDefinition, NewTrackerRecord, TrackerDefinition, TrackerDefinitionChanges, TrackerField, TrackerRecord, TrackerRecordChanges } from "@/types/tracker";
import type { TrackerRepository } from "@/lib/data/tracker-repository";
import { normalizeField, validateTrackerDefinition, validateTrackerRecord } from "@/lib/data/tracker-validation";

const DEFINITIONS_KEY = "meongo.demo.tracker-definitions.v1";
const RECORDS_KEY = "meongo.demo.tracker-records.v1";
const LOCAL_DEMO_USER_ID = "local-demo";

function storage(): Storage {
  if (typeof window === "undefined") throw new Error("Local demo trackers are only available in the browser.");
  return window.localStorage;
}

function recordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJson<T>(key: string): T[] {
  const raw = storage().getItem(key);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(recordLike)) throw new Error("Invalid data");
    return parsed as T[];
  } catch {
    throw new Error("Tracker demo data could not be read. Clear this device’s ME ON GO demo data to continue.");
  }
}

function writeJson<T>(key: string, values: T[]): void {
  storage().setItem(key, JSON.stringify(values));
}

function validDefinition(value: unknown): value is TrackerDefinition {
  if (!recordLike(value)) return false;
  return typeof value.id === "string" && typeof value.userId === "string" && typeof value.name === "string" &&
    (value.description === null || typeof value.description === "string") && Array.isArray(value.fields) &&
    value.fields.every((field) => recordLike(field) && typeof field.id === "string" && typeof field.trackerId === "string" &&
      typeof field.name === "string" && typeof field.type === "string" && typeof field.position === "number" &&
      typeof field.required === "boolean" && typeof field.active === "boolean" && Array.isArray(field.options)) &&
    typeof value.createdAt === "string" && typeof value.updatedAt === "string";
}

function readDefinitions(): TrackerDefinition[] {
  const rows = readJson<unknown>(DEFINITIONS_KEY);
  if (!rows.every(validDefinition)) throw new Error("Tracker definitions are invalid. Clear this device’s ME ON GO demo data to continue.");
  return rows;
}

function validRecord(value: unknown): value is TrackerRecord {
  return recordLike(value) && typeof value.id === "string" && typeof value.trackerId === "string" &&
    typeof value.userId === "string" && typeof value.occurredOn === "string" &&
    (value.occurredAt === null || typeof value.occurredAt === "string") && recordLike(value.values) &&
    typeof value.createdAt === "string" && typeof value.updatedAt === "string";
}

function readRecords(): TrackerRecord[] {
  const rows = readJson<unknown>(RECORDS_KEY);
  if (!rows.every(validRecord)) throw new Error("Tracker records are invalid. Clear this device’s ME ON GO demo data to continue.");
  return rows;
}

function ownedTracker(id: string, definitions = readDefinitions()): TrackerDefinition {
  const tracker = definitions.find((row) => row.id === id && row.userId === LOCAL_DEMO_USER_ID);
  if (!tracker) throw new Error("Tracker not found on this device.");
  return tracker;
}

export class LocalDemoTrackerRepository implements TrackerRepository {
  async listTrackers(): Promise<TrackerDefinition[]> {
    return readDefinitions().filter((row) => row.userId === LOCAL_DEMO_USER_ID).sort((a, b) => a.name.localeCompare(b.name));
  }

  async findTracker(id: string): Promise<TrackerDefinition | null> {
    return readDefinitions().find((row) => row.id === id && row.userId === LOCAL_DEMO_USER_ID) ?? null;
  }

  async createTracker(input: NewTrackerDefinition): Promise<TrackerDefinition> {
    const error = validateTrackerDefinition(input);
    if (error) throw new Error(error);
    const definitions = readDefinitions();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const tracker: TrackerDefinition = {
      id,
      userId: LOCAL_DEMO_USER_ID,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      fields: input.fields.map((source, position) => {
        const field = normalizeField(source, position);
        return { ...field, id: crypto.randomUUID(), trackerId: id, createdAt: now, updatedAt: now } as TrackerField;
      }),
      createdAt: now,
      updatedAt: now,
    };
    writeJson(DEFINITIONS_KEY, [...definitions, tracker]);
    return tracker;
  }

  async updateTracker(id: string, changes: TrackerDefinitionChanges): Promise<TrackerDefinition> {
    const definitions = readDefinitions();
    const current = ownedTracker(id, definitions);
    const records = readRecords().filter((row) => row.trackerId === id && row.userId === current.userId);
    const nextInput: NewTrackerDefinition = {
      name: changes.name ?? current.name,
      description: changes.description === undefined ? current.description : changes.description,
      fields: (changes.fields ?? current.fields).map((field, position) => normalizeField(field, position)),
    };
    const error = validateTrackerDefinition(nextInput);
    if (error) throw new Error(error);

    const currentFields = new Map(current.fields.map((field) => [field.id, field]));
    for (const old of current.fields) {
      const hasHistoricalValues = records.some((record) => Object.hasOwn(record.values, old.id));
      const replacement = nextInput.fields.find((field) => field.id === old.id);
      if (hasHistoricalValues && !replacement) throw new Error(`${old.name} has saved values. Deactivate it to preserve history.`);
      if (hasHistoricalValues && replacement && replacement.type !== old.type) throw new Error(`${old.name} has saved values and its type can’t be changed.`);
      if (hasHistoricalValues && old.type === "SELECT" && replacement) {
        const used = new Set(records.map((record) => record.values[old.id]).filter((value): value is string => typeof value === "string"));
        if ([...used].some((value) => !replacement.options.includes(value))) throw new Error(`${old.name} has historical selections. Keep the options already used.`);
      }
    }
    for (const field of nextInput.fields) {
      if (field.id && !currentFields.has(field.id)) throw new Error("A field does not belong to this tracker.");
    }
    const now = new Date().toISOString();
    const fields = nextInput.fields.map((source, position) => {
      const normalized = normalizeField(source, position);
      const old = source.id ? currentFields.get(source.id) : undefined;
      return {
        ...normalized,
        id: old?.id ?? crypto.randomUUID(),
        trackerId: id,
        createdAt: old?.createdAt ?? now,
        updatedAt: now,
      } as TrackerField;
    });
    const updated: TrackerDefinition = { ...current, name: nextInput.name.trim(), description: nextInput.description?.trim() || null, fields, updatedAt: now };
    writeJson(DEFINITIONS_KEY, definitions.map((row) => row.id === id ? updated : row));
    return updated;
  }

  async deleteTracker(id: string): Promise<void> {
    const current = ownedTracker(id);
    writeJson(DEFINITIONS_KEY, readDefinitions().filter((row) => row.id !== id));
    writeJson(RECORDS_KEY, readRecords().filter((row) => row.trackerId !== id || row.userId !== current.userId));
  }

  async getFieldUsage(trackerId: string): Promise<Record<string, number>> {
    ownedTracker(trackerId);
    const usage: Record<string, number> = {};
    for (const record of readRecords().filter((row) => row.trackerId === trackerId)) {
      for (const fieldId of Object.keys(record.values)) usage[fieldId] = (usage[fieldId] ?? 0) + 1;
    }
    return usage;
  }

  async listRecords(trackerId: string): Promise<TrackerRecord[]> {
    const tracker = ownedTracker(trackerId);
    return readRecords().filter((row) => row.trackerId === tracker.id && row.userId === tracker.userId)
      .sort((a, b) => `${b.occurredOn}T${b.occurredAt ?? "00:00:00"}`.localeCompare(`${a.occurredOn}T${a.occurredAt ?? "00:00:00"}`));
  }

  async findRecord(trackerId: string, recordId: string): Promise<TrackerRecord | null> {
    const tracker = ownedTracker(trackerId);
    return readRecords().find((row) => row.id === recordId && row.trackerId === tracker.id && row.userId === tracker.userId) ?? null;
  }

  async createRecord(trackerId: string, input: NewTrackerRecord): Promise<TrackerRecord> {
    const tracker = ownedTracker(trackerId);
    const error = validateTrackerRecord(tracker, input);
    if (error) throw new Error(error);
    const now = new Date().toISOString();
    const record: TrackerRecord = { ...input, trackerId, userId: tracker.userId, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    writeJson(RECORDS_KEY, [...readRecords(), record]);
    return record;
  }

  async updateRecord(trackerId: string, recordId: string, changes: TrackerRecordChanges): Promise<TrackerRecord> {
    const tracker = ownedTracker(trackerId);
    const rows = readRecords();
    const current = rows.find((row) => row.id === recordId && row.trackerId === trackerId && row.userId === tracker.userId);
    if (!current) throw new Error("Record not found on this device.");
    const allowedInactiveValues = tracker.fields.filter((field) => !field.active && Object.hasOwn(current.values, field.id)).map((field) => field.id);
    const updated = { ...current, ...changes, trackerId, userId: tracker.userId, id: current.id, updatedAt: new Date().toISOString() };
    const error = validateTrackerRecord(tracker, updated, allowedInactiveValues);
    if (error) throw new Error(error);
    writeJson(RECORDS_KEY, rows.map((row) => row.id === recordId ? updated : row));
    return updated;
  }

  async deleteRecord(trackerId: string, recordId: string): Promise<void> {
    const tracker = ownedTracker(trackerId);
    const rows = readRecords();
    writeJson(RECORDS_KEY, rows.filter((row) => !(row.id === recordId && row.trackerId === trackerId && row.userId === tracker.userId)));
  }
}
