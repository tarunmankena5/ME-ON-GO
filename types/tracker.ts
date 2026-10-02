export const TRACKER_FIELD_TYPES = [
  "TEXT",
  "NUMBER",
  "DURATION",
  "DATE",
  "TIME",
  "RATING",
  "BOOLEAN",
  "SELECT",
  "NOTES",
] as const;

export type TrackerFieldType = (typeof TRACKER_FIELD_TYPES)[number];
export type TrackerValue = string | number | boolean;
export type TrackerValues = Record<string, TrackerValue>;

export type TrackerField = {
  id: string;
  trackerId: string;
  name: string;
  type: TrackerFieldType;
  unit: string | null;
  required: boolean;
  position: number;
  active: boolean;
  options: string[];
  createdAt: string;
  updatedAt: string;
};

export type TrackerDefinition = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  fields: TrackerField[];
  createdAt: string;
  updatedAt: string;
};

export type TrackerRecord = {
  id: string;
  trackerId: string;
  userId: string;
  occurredOn: string;
  /** Null when the user records a date without a time. */
  occurredAt: string | null;
  values: TrackerValues;
  createdAt: string;
  updatedAt: string;
};

export type TrackerFieldInput = Omit<TrackerField, "id" | "trackerId" | "createdAt" | "updatedAt"> & { id?: string };
export type NewTrackerDefinition = { name: string; description: string | null; fields: TrackerFieldInput[] };
export type TrackerDefinitionChanges = Partial<NewTrackerDefinition>;
export type NewTrackerRecord = { occurredOn: string; occurredAt: string | null; values: TrackerValues };
export type TrackerRecordChanges = Partial<NewTrackerRecord>;

export type TrackerTemplate = {
  id: string;
  name: string;
  description: string;
  fields: Array<Omit<TrackerFieldInput, "position" | "active">>;
};
