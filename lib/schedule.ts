export const SPORTS = [
  { id: 'basketball', label: 'Basketball' },
  { id: 'soccer', label: 'Soccer / Football' },
  { id: 'volleyball', label: 'Volleyball' },
  { id: 'tennis', label: 'Tennis' },
  { id: 'badminton', label: 'Badminton' },
] as const;
export type Sport = typeof SPORTS[number]['id'];
export type Slot = { day_of_week: number; start_time: string; end_time: string };
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function errorMessage(error: unknown): string {
  return typeof error === 'object' && error !== null && 'message' in error
    ? String(error.message) : 'Something went wrong. Please try again.';
}

export type Schedule = { sports: Sport[]; slots: Slot[] };

export function minutes(time: string): number {
  if (typeof time !== 'string') return NaN;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(time) && time !== '24:00' && time !== '24:00:00') return NaN;
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function validateSchedule(sports: readonly string[], slots: readonly Slot[]): string | null {
  if (!sports.length) return 'Choose at least one sport.';
  if (sports.some(sport => !SPORTS.some(item => item.id === sport))) return 'This schedule includes an unsupported sport.';
  if (!slots.length) return 'Add at least one availability window.';
  return validateWindows(slots);
}

export function windowIssue(slots: readonly Slot[], index: number): string | null {
  const slot = slots[index];
  if (!slot || !Number.isInteger(slot.day_of_week) || slot.day_of_week < 1 || slot.day_of_week > 7 ||
    !Number.isFinite(minutes(slot.start_time)) || !Number.isFinite(minutes(slot.end_time)) ||
    minutes(slot.start_time) >= minutes(slot.end_time)) return 'Choose a start time earlier than the end time.';
  if (slots.some((other, otherIndex) => otherIndex !== index && other.day_of_week === slot.day_of_week &&
    minutes(slot.start_time) < minutes(other.end_time) && minutes(slot.end_time) > minutes(other.start_time))) {
    return 'This overlaps another window on this day.';
  }
  return null;
}

export function validateWindows(slots: readonly Slot[]): string | null {
  for (let i = 0; i < slots.length; i++) {
    const issue = windowIssue(slots, i);
    if (issue) return `${DAYS[slots[i].day_of_week - 1] ?? 'Invalid day'}: ${issue}`;
  }
  return null;
}

function normalizeTime(time: string) { return /^\d{2}:\d{2}:00$/.test(time) ? time.slice(0, 5) : time; }

export function scheduleKey(schedule: Schedule): string {
  return JSON.stringify({ sports: [...schedule.sports].sort(), slots: schedule.slots.map(slot => ({
    day_of_week: slot.day_of_week, start_time: normalizeTime(slot.start_time), end_time: normalizeTime(slot.end_time),
  })).sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time) || a.end_time.localeCompare(b.end_time)) });
}

export function copyDay(slots: Slot[], source: number, targets: number[]): Slot[] {
  const days = [...new Set(targets)].filter(day => day !== source && day >= 1 && day <= 7);
  const windows = slots.filter(slot => slot.day_of_week === source);
  return [...slots.filter(slot => !days.includes(slot.day_of_week)), ...days.flatMap(day => windows.map(slot => ({ ...slot, day_of_week: day })))];
}

export function hourTime(hour: number) { return `${String(hour).padStart(2, '0')}:00`; }
export function timeLabel(time: string): string {
  if (!Number.isFinite(minutes(time))) return 'Choose time';
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, '0')}` : ''} ${hour < 12 || hour === 24 ? 'AM' : 'PM'}${hour === 24 ? ' (next day)' : ''}`;
}
