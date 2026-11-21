import { supabase } from './supabase';
import { readWithTimeout } from './requests';
import { SPORTS, Slot, Sport, validateSchedule } from './schedule';

export type Game = {
  id: string;
  sport: string;
  starts_at: string;
  location: string | null;
  status: string;
  venue_id: string | null;
  venue_name: string | null;
  player_count: number;
  rsvp_status: string;
};

export async function loadSchedule(userId: string): Promise<{ sports: Sport[]; slots: Slot[] }> {
  const [preferences, availability] = await readWithTimeout(Promise.all([
    supabase.from('user_sports').select('sport_id, sports(*)').eq('user_id', userId),
    supabase.from('weekly_availability').select('day_of_week, start_time, end_time').eq('user_id', userId)
      .order('day_of_week').order('start_time'),
  ]));
  if (preferences.error) throw preferences.error;
  if (availability.error) throw availability.error;
  const sports = (preferences.data ?? []).map(row => {
    // The relation may use a text ID or a slug beside a numeric ID.
    const related = Array.isArray(row.sports) ? row.sports[0] : row.sports;
    const record = related as Record<string, unknown> | null;
    const values = [row.sport_id, record?.id, record?.slug, record?.name, record?.sport, record?.code]
      .filter((value): value is string => typeof value === 'string').map(value => value.toLowerCase());
    const sport = SPORTS.find(item => values.includes(item.id) || values.includes(item.label.toLowerCase()));
    if (!sport) throw new Error('A saved sport could not be read. Your schedule has not been changed.');
    return sport.id;
  });
  const slots = availability.data ?? [];
  return { sports: [...new Set(sports)], slots };
}

export type ScheduleSaveResult = {
  removed_count: number;
  removed_games: {
    game_id: string;
    sport: string;
    starts_at: string;
    venue_name: string | null;
    reason: string;
    new_offers: unknown;
  }[];
};

export async function saveSchedule(sports: Sport[], slots: Slot[]): Promise<ScheduleSaveResult> {
  const validation = validateSchedule(sports, slots);
  if (validation) throw new Error(validation);
  const { data, error } = await supabase.rpc('save_my_schedule', { p_sports: sports, p_slots: slots });
  if (error) throw error;
  const result = data as ScheduleSaveResult | null;
  return { removed_count: result?.removed_count ?? 0, removed_games: result?.removed_games ?? [] };
}

export async function loadGames(): Promise<Game[]> {
  const { data, error } = await readWithTimeout(supabase.rpc('get_my_games'));
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('The games response was not a list. Please try again.');
  const games = data as Game[];
  if (games.some(game => !game || typeof game.id !== 'string' || typeof game.sport !== 'string' ||
    typeof game.starts_at !== 'string' || !Number.isFinite(Date.parse(game.starts_at)) ||
    typeof game.status !== 'string' || typeof game.rsvp_status !== 'string' || !Number.isFinite(Number(game.player_count)) || Number(game.player_count) < 0 ||
    [game.venue_name, game.location].some(value => value != null && typeof value !== 'string'))) {
    throw new Error('Some game details could not be read. Please refresh or report this error.');
  }
  // The backend owns the upcoming-game selection. Do not hide its results using the device clock.
  return games.filter(game => game.status === 'confirmed' && game.rsvp_status !== 'declined')
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}
