import type {
  NewTrackerDefinition,
  NewTrackerRecord,
  TrackerDefinition,
  TrackerDefinitionChanges,
  TrackerRecord,
  TrackerRecordChanges,
} from "@/types/tracker";

/** Data boundary for custom trackers. Record values are keyed by stable field IDs. */
export interface TrackerRepository {
  listTrackers(): Promise<TrackerDefinition[]>;
  findTracker(id: string): Promise<TrackerDefinition | null>;
  createTracker(input: NewTrackerDefinition): Promise<TrackerDefinition>;
  updateTracker(id: string, changes: TrackerDefinitionChanges): Promise<TrackerDefinition>;
  getFieldUsage(trackerId: string): Promise<Record<string, number>>;
  deleteTracker(id: string): Promise<void>;
  listRecords(trackerId: string): Promise<TrackerRecord[]>;
  findRecord(trackerId: string, recordId: string): Promise<TrackerRecord | null>;
  createRecord(trackerId: string, input: NewTrackerRecord): Promise<TrackerRecord>;
  updateRecord(trackerId: string, recordId: string, changes: TrackerRecordChanges): Promise<TrackerRecord>;
  deleteRecord(trackerId: string, recordId: string): Promise<void>;
}
