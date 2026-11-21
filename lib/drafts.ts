import AsyncStorage from '@react-native-async-storage/async-storage';
import { Schedule, SPORTS, scheduleKey } from './schedule';

type Draft = Schedule & { base: string };
const queue = new Map<string, Promise<void>>();
const keyFor = (userId: string) => `runit:schedule-draft:v1:${userId}`;

// Serialize writes and removals so a delayed autosave cannot recreate a discarded draft.
function enqueue(userId: string, action: () => Promise<void>): Promise<void> {
  const key = keyFor(userId);
  const next = (queue.get(key) ?? Promise.resolve()).catch(() => {}).then(action);
  queue.set(key, next);
  void next.finally(() => { if (queue.get(key) === next) queue.delete(key); }).catch(() => {});
  return next;
}
export function storeDraft(userId: string, schedule: Schedule, base: string) {
  const value = JSON.stringify({ ...schedule, base });
  return enqueue(userId, () => AsyncStorage.setItem(keyFor(userId), value));
}
export function clearDraft(userId: string) {
  return enqueue(userId, () => AsyncStorage.removeItem(keyFor(userId)));
}
export async function readDraft(userId: string, saved: Schedule): Promise<Draft | null> {
  await (queue.get(keyFor(userId)) ?? Promise.resolve()).catch(() => {});
  const raw = await AsyncStorage.getItem(keyFor(userId));
  if (!raw) return null;
  const draft = JSON.parse(raw) as Draft;
  if (!draft || typeof draft.base !== 'string' || !Array.isArray(draft.sports) || !Array.isArray(draft.slots) ||
    !draft.sports.every(sport => SPORTS.some(item => item.id === sport)) ||
    !draft.slots.every(slot => slot && Number.isInteger(slot.day_of_week) && slot.day_of_week >= 1 && slot.day_of_week <= 7 && typeof slot.start_time === 'string' && typeof slot.end_time === 'string')) {
    throw new Error('The local draft could not be read. Your saved schedule is still available.');
  }
  if (scheduleKey(draft) === scheduleKey(saved)) { await clearDraft(userId); return null; }
  return draft;
}
