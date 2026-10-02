export type EntryKind = "ACTIVITY" | "TASK" | "EVENT";
export type TaskPriority = "LOW" | "NORMAL" | "HIGH";
export type EntryMetadata = Record<string, unknown>;

type EntryBase = {
  id: string;
  userId: string;
  title: string;
  notes: string | null;
  metadata: EntryMetadata;
  createdAt: string;
  updatedAt: string;
};

export type ActivityEntry = EntryBase & {
  kind: "ACTIVITY";
  activityType: string | null;
  occurredAt: string;
};

export type TaskEntry = EntryBase & {
  kind: "TASK";
  dueAt: string | null;
  priority: TaskPriority;
  category: string | null;
  completedAt: string | null;
};

export type EventEntry = EntryBase & {
  kind: "EVENT";
  startsAt: string;
  endsAt: string | null;
};

export type Entry = ActivityEntry | TaskEntry | EventEntry;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, Extract<keyof T, K>>
  : never;

export type NewEntry = DistributiveOmit<
  Entry,
  "id" | "userId" | "createdAt" | "updatedAt"
>;
export type EntryChanges = Entry extends infer T
  ? T extends Entry
    ? Partial<Omit<T, "id" | "userId" | "kind" | "createdAt" | "updatedAt">>
    : never
  : never;

export type Profile = {
  id: string;
  displayName: string | null;
  timeZone: string;
  createdAt: string;
  updatedAt: string;
};
