import { supabase } from './supabase';
import { readWithTimeout } from './requests';

export type Response = 'accept' | 'decline';

function checkResult(data: unknown, error: { message: string } | null): void {
  if (error) throw error;
  // Some RPCs report business-rule errors in JSON instead of raising a SQL error.
  if (data && typeof data === 'object' && (('success' in data && data.success === false) || ('ok' in data && data.ok === false))) {
    const message = 'message' in data ? data.message : 'error' in data ? data.error : 'The response was not accepted. Refresh and try again.';
    throw new Error(String(message));
  }
}

export async function refreshGameOffers(): Promise<void> {
  const { data, error } = await readWithTimeout(supabase.rpc('refresh_game_offers'));
  checkResult(data, error);
}

export async function respondToGame(gameId: string, response: Response): Promise<void> {
  if (!gameId || !['accept', 'decline'].includes(response)) throw new Error('Choose a valid RSVP response.');
  const { data, error } = await supabase.rpc('respond_to_game_rsvp', { p_game_id: gameId, p_response: response });
  checkResult(data, error);
}

export async function respondToOffer(offerId: string, response: Response): Promise<void> {
  if (!offerId || !['accept', 'decline'].includes(response)) throw new Error('Choose a valid invitation response.');
  const { data, error } = await supabase.rpc('respond_to_game_offer', { p_offer_id: offerId, p_response: response });
  checkResult(data, error);
}

export type GameOffer = {
  id: string;
  game_id: string;
  sport: string;
  starts_at: string;
  expires_at: string;
  venue_name: string | null;
  location: string | null;
  status: string | null;
};

type RecordValue = Record<string, unknown>;
function isRecord(value: unknown): value is RecordValue { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function timestamp(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }

export async function loadOffers(): Promise<GameOffer[]> {
  const { data, error } = await readWithTimeout(supabase.rpc('get_my_offers'));
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('The invitations response was not a list. Please refresh.');
  const offers = data.map((row: unknown): GameOffer => {
    if (!isRecord(row)) throw new Error('An invitation could not be read.');
    // Accept either common RPC identifier alias, without inventing missing values.
    const id = row.offer_id ?? row.id;
    const status = row.offer_status ?? row.status ?? null;
    if (typeof id !== 'string' || typeof row.game_id !== 'string' || typeof row.sport !== 'string' ||
      !timestamp(row.starts_at) || !timestamp(row.expires_at) ||
      (status !== null && typeof status !== 'string') ||
      [row.venue_name, row.location].some(value => value != null && typeof value !== 'string')) {
      throw new Error('Invitation details could not be read. Expected an offer ID, game ID, sport, start time, and expiration deadline.');
    }
    return { id, game_id: row.game_id, sport: row.sport, starts_at: row.starts_at, expires_at: row.expires_at,
      venue_name: (row.venue_name as string | null) ?? null, location: (row.location as string | null) ?? null, status };
  });
  return offers.sort((a, b) => Date.parse(a.expires_at) - Date.parse(b.expires_at));
}

export function canRespondToGame(status: string, startsAt: string, response: Response, now = Date.now()): boolean {
  return Date.parse(startsAt) > now && (status === 'pending' || (status === 'accepted' && response === 'decline'));
}

export function canRespondToOffer(offer: GameOffer, now = Date.now()): boolean {
  return (offer.status === null || offer.status === 'pending' || offer.status === 'offered') &&
    Date.parse(offer.expires_at) > now && Date.parse(offer.starts_at) > now;
}
