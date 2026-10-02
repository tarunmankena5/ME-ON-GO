import type { TaskEntry } from "@/types/entry";
import { addDaysToDateKey, getDateKeyInTimeZone, isDateOnlyTimestamp } from "@/lib/dates/time-zone";

export function isTaskOverdue(task: TaskEntry, now: Date, timeZone: string): boolean {
  if (task.completedAt !== null || task.dueAt === null) return false;
  const today = getDateKeyInTimeZone(now, timeZone);
  const dueDay = getDateKeyInTimeZone(new Date(task.dueAt), timeZone);
  if (dueDay < today) return true;
  if (dueDay > today || isDateOnlyTimestamp(task.dueAt, timeZone)) return false;
  return new Date(task.dueAt).valueOf() < now.valueOf();
}

export function daysOverdue(task: TaskEntry, now: Date, timeZone: string): number {
  if (!task.dueAt) return 0;
  const dueDay = getDateKeyInTimeZone(new Date(task.dueAt), timeZone);
  const today = getDateKeyInTimeZone(now, timeZone);
  return Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDay}T00:00:00Z`)) / 86_400_000));
}

export function sortTasks(tasks: TaskEntry[], timeZone: string, now = new Date()): TaskEntry[] {
  return [...tasks].sort((left, right) => {
    const leftOverdue = isTaskOverdue(left, now, timeZone);
    const rightOverdue = isTaskOverdue(right, now, timeZone);
    if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;
    const leftCompleted = left.completedAt !== null;
    const rightCompleted = right.completedAt !== null;
    if (leftCompleted !== rightCompleted) return leftCompleted ? 1 : -1;
    const priorityOrder = { HIGH: 0, NORMAL: 1, LOW: 2 };
    const priorityDifference = priorityOrder[left.priority] - priorityOrder[right.priority];
    if (priorityDifference !== 0) return priorityDifference;
    if (left.dueAt === null || right.dueAt === null) {
      if (left.dueAt === null && right.dueAt !== null) return 1;
      if (right.dueAt === null && left.dueAt !== null) return -1;
    }
    const dueDifference = (left.dueAt ? Date.parse(left.dueAt) : Date.parse(left.createdAt)) - (right.dueAt ? Date.parse(right.dueAt) : Date.parse(right.createdAt));
    return dueDifference || left.createdAt.localeCompare(right.createdAt);
  });
}

export function deadlineLabel(task: TaskEntry, now: Date, timeZone: string): string | null {
  if (!isTaskOverdue(task, now, timeZone)) return null;
  const days = daysOverdue(task, now, timeZone);
  return days === 0 ? "Less than a day overdue" : `${days} ${days === 1 ? "day" : "days"} overdue`;
}

export function dateAfter(dateKey: string, days: number): string {
  return addDaysToDateKey(dateKey, days);
}
