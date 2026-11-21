import { supabase } from './supabase';
import { readWithTimeout } from './requests';

export type GamePlayer = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  rsvp_status: 'pending' | 'accepted';
};

export async function loadGamePlayers(gameId: string): Promise<GamePlayer[]> {
  if (!gameId) throw new Error('Select a game to view its players.');
  const { data, error } = await readWithTimeout(supabase.rpc('get_game_players', { p_game_id: gameId }));
  if (error) throw error;
  if (!Array.isArray(data) || data.some(row => !row || typeof row.user_id !== 'string' ||
    typeof row.rsvp_status !== 'string' ||
    [row.display_name, row.username].some(value => value != null && typeof value !== 'string'))) {
    throw new Error('The matched players could not be read.');
  }
  return [...new Map(data.filter(row => row.rsvp_status === 'pending' || row.rsvp_status === 'accepted')
    .map(row => [row.user_id, row])).values()].map(row => ({
      user_id: row.user_id,
      display_name: row.display_name?.trim() || null,
      username: row.username?.trim() || null,
      rsvp_status: row.rsvp_status as GamePlayer['rsvp_status'],
    })).sort((a, b) => Number(b.rsvp_status === 'accepted') - Number(a.rsvp_status === 'accepted') ||
    (a.display_name ?? a.username ?? '').localeCompare(b.display_name ?? b.username ?? ''));
}
