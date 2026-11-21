import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Game, loadGames, loadSchedule } from '../lib/matchmaking';
import { GameOffer, Response, canRespondToGame, canRespondToOffer, loadOffers, refreshGameOffers, respondToGame, respondToOffer } from '../lib/rsvp';
import { DAYS, SPORTS, Schedule, errorMessage, timeLabel, validateSchedule } from '../lib/schedule';
import { Button, ErrorNotice, PressSurface, useUI } from './ui';
import { Palette } from './ThemeProvider';
import ThemeToggle from './ThemeToggle';
import GameDetailsScreen from './GameDetailsScreen';
import GameRsvpActions from './GameRsvpActions';
import AmbientBackground from './AmbientBackground';
import ScreenEntrance from './ScreenEntrance';

type Props = { userId: string; displayName: string; onEditProfile: () => void; onAvailability: () => void; onSignOut: () => void; signingOut: boolean; scheduleSaved: boolean; removedGamesCount?: number };
const dateFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

export default function HomeScreen({ userId, displayName, onEditProfile, onAvailability, onSignOut, signingOut, scheduleSaved, removedGamesCount = 0 }: Props) {
  const { colors, ui, reduceMotion } = useUI();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [offers, setOffers] = useState<GameOffer[]>([]);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [offersCheckedAt, setOffersCheckedAt] = useState<number | null>(null);
  const [action, setAction] = useState<{ key: string; response: Response } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const actionLock = useRef(false);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rosterRefreshKey, setRosterRefreshKey] = useState(0);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const active = useRef(false);
  const request = useRef(0);
  const inFlight = useRef<number | null>(null);
  const refresh = useCallback(async (showLoading = true, force = false) => {
    if (!force && (inFlight.current !== null || actionLock.current)) return;
    const id = ++request.current;
    inFlight.current = id;
    if (showLoading) setLoading(true);
    try {
      // Refill/expire invitations before reading. A maintenance error must not hide existing games.
      let maintenance: string | null = null;
      try { await refreshGameOffers(); } catch (error) { maintenance = errorMessage(error); }
      if (!active.current || id !== request.current) return;
      const [gameResult, offerResult, scheduleResult] = await Promise.allSettled([loadGames(), loadOffers(), loadSchedule(userId)]);
      if (!active.current || id !== request.current) return;
      setRosterRefreshKey(value => value + 1);
      setMaintenanceError(maintenance);
      setNow(Date.now());
      if (gameResult.status === 'fulfilled') {
        setGames(gameResult.value);
        setError(null);
        setCheckedAt(Date.now());
      } else setError(errorMessage(gameResult.reason));
      if (offerResult.status === 'fulfilled') {
        setOffers(offerResult.value);
        setOffersError(null);
        setOffersCheckedAt(Date.now());
      } else setOffersError(errorMessage(offerResult.reason));
      if (scheduleResult.status === 'fulfilled') {
        setSchedule(scheduleResult.value);
        setScheduleError(null);
      } else setScheduleError(errorMessage(scheduleResult.reason));
    } finally {
      if (active.current && id === request.current) { setLoading(false); inFlight.current = null; }
    }
  }, [userId]);
  useEffect(() => {
    active.current = true;
    inFlight.current = null;
    void refresh();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') { setNow(Date.now()); void refresh(false); }
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') { setNow(Date.now()); void refresh(false); }
    }, 20000);
    const clock = setInterval(() => { if (AppState.currentState === 'active') setNow(Date.now()); }, 1000);
    return () => { active.current = false; clearInterval(timer); clearInterval(clock); listener.remove(); };
  }, [refresh]);
  async function respond(kind: 'game' | 'offer', item: Game | GameOffer, response: Response) {
    if (actionLock.current || signingOut) return;
    const allowed = kind === 'game'
      ? canRespondToGame((item as Game).rsvp_status, item.starts_at, response)
      : canRespondToOffer(item as GameOffer);
    if (!allowed) {
      setActionError('This response is no longer available. Refreshing the latest games and invitations.');
      await refresh(true);
      return;
    }
    actionLock.current = true;
    setAction({ key: `${kind}:${item.id}`, response });
    setActionError(null);
    // Invalidate any pre-action read so it cannot restore a declined game or old offer.
    request.current++;
    try {
      if (kind === 'game') await respondToGame(item.id, response);
      else await respondToOffer(item.id, response);
    } catch (error) {
      if (active.current) setActionError(errorMessage(error));
    } finally {
      // Refresh on both success and failure: a rejected/expired offer may have changed server state.
      if (active.current) await refresh(false, true);
      actionLock.current = false;
      if (active.current) setAction(null);
    }
  }
  const controlsDisabled = signingOut || action !== null;
  const selectedGame = games.find(game => game.id === selectedGameId) ?? null;
  function closeDetails() { if (!actionLock.current) setSelectedGameId(null); }
  function openDetails(gameId: string) {
    if (actionLock.current || signingOut) return;
    setSelectedGameId(gameId);
    setActionError(null);
    void refresh(false);
  }
  const ready = schedule !== null && validateSchedule(schedule.sports, schedule.slots) === null;

  return <View style={ui.screen}>
  <AmbientBackground paused={selectedGameId !== null} />
  <ScreenEntrance>
  <ScrollView style={{ flex: 1 }} contentContainerStyle={ui.content}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void refresh(); }} tintColor={colors.green} />}>
    <View style={ui.row}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Text style={styles.logo}>RunIt</Text><ThemeToggle /></View>
      <Text style={ui.eyebrow}>UMASS AMHERST</Text>
    </View>
    <View style={styles.hero}>
      <View pointerEvents="none" style={styles.courtMark} />
      <Text style={styles.heroText}>No organizer. Just play.</Text>
      <Text style={styles.heroTitle}>{displayName}, ready to play?</Text>
      <Button label="Set my availability" onPress={onAvailability} secondary disabled={controlsDisabled} />
    </View>
    {(scheduleSaved || removedGamesCount > 0) && <View accessibilityLiveRegion="polite" style={[ui.card, { backgroundColor: colors.pale }]}>
      <Text style={[ui.heading, { fontSize: 18 }]}>{removedGamesCount > 0 ? 'Schedule updated' : 'Schedule saved'}</Text>
      <Text style={ui.text}>{removedGamesCount > 0
        ? `${removedGamesCount} ${removedGamesCount === 1 ? 'game was' : 'games were'} removed because your availability changed.`
        : 'New matches will appear below.'}</Text>
    </View>}
    {actionError && <ErrorNotice message={actionError} />}
    {maintenanceError && <ErrorNotice message={`Unable to refresh replacement spots: ${maintenanceError}`} />}
    {(maintenanceError || offersError || actionError || error || scheduleError) && <Button label="Try again" secondary onPress={() => { void refresh(); }} disabled={loading || controlsDisabled} />}
    <View style={ui.row}>
      <Text style={ui.heading}>Your games</Text>
      <Text style={ui.eyebrow}>{games.length} CONFIRMED</Text>
    </View>
    {error && checkedAt !== null && <Text style={ui.text}>Showing the last successful results. They may be out of date.</Text>}
    {loading && <ActivityIndicator accessibilityLabel="Loading confirmed games" color={colors.green} />}
    {error ? <ErrorNotice message={`Unable to refresh games: ${error}`} /> : !loading && games.length === 0 ? <View style={ui.card}>
      <Text style={ui.heading}>No games yet</Text>
      <Text style={ui.text}>{ready ? 'We’ll match you when a spot fits your schedule.' : schedule ? 'Set your availability to start matching.' : 'Your schedule could not be loaded. Try refreshing.'}</Text>
    </View> : null}
    {games.map(game => <View style={ui.card} key={game.id}>
      <PressSurface accessibilityRole="button" accessibilityLabel={`View ${SPORTS.find(sport => sport.id === game.sport)?.label ?? game.sport} game details`}
        accessibilityHint="Opens venue, time, players, and RSVP" disabled={controlsDisabled} onPress={() => openDetails(game.id)} style={{ gap: 12 }}>
        <View style={ui.row}>
          <Text style={[ui.heading, { flex: 1 }]}>{SPORTS.find(sport => sport.id === game.sport)?.label ?? game.sport}</Text>
          <Text style={styles.status}>{game.rsvp_status === 'accepted' ? 'Going' : game.rsvp_status === 'pending' ? 'RSVP needed' : game.rsvp_status}</Text>
        </View>
        <Text style={styles.date}>{dateFormat.format(new Date(game.starts_at))} · {timeFormat.format(new Date(game.starts_at))}</Text>
        {Date.parse(game.starts_at) <= now && <Text style={ui.text}>Scheduled start has passed. Check the listed date and time before heading out.</Text>}
        <View style={styles.venue}>
          <Text style={styles.venueName}>{game.venue_name || game.location || 'Venue not provided'}</Text>
          <Text style={ui.text}>{game.player_count} matched player{Number(game.player_count) === 1 ? '' : 's'}</Text>
        </View>
        <Text style={[ui.text, { color: colors.green, fontWeight: '700' }]}>View details</Text>
      </PressSurface>
      <GameRsvpActions game={game} now={now} disabled={controlsDisabled || !!error}
        pendingResponse={action?.key === `game:${game.id}` ? action.response : null}
        onRespond={response => { void respond('game', game, response); }} />
    </View>)}
    <View style={ui.row}>
      <Text style={ui.heading}>Replacement invitations</Text>
    </View>
    {offersError && <>
      <ErrorNotice message={`Unable to refresh invitations: ${offersError}`} />
      {offersCheckedAt !== null && <Text style={ui.text}>Showing the last loaded invitations. Availability may have changed.</Text>}
    </>}
    {!loading && !offersError && !offers.length && <Text style={ui.text}>No replacement invitations right now.</Text>}
    {offers.map(offer => {
      const available = canRespondToOffer(offer, now);
      const expired = Date.parse(offer.expires_at) <= now;
      const busy = action?.key === `offer:${offer.id}`;
      return <View key={offer.id} style={ui.card}>
        <View style={ui.row}>
          <Text style={[ui.heading, { flex: 1 }]}>{SPORTS.find(sport => sport.id === offer.sport)?.label ?? offer.sport}</Text>
          <Text style={styles.status}>{expired ? 'Expired' : offer.status === null || offer.status === 'pending' || offer.status === 'offered' ? 'Invitation' : offer.status}</Text>
        </View>
        <Text style={styles.date}>{dateFormat.format(new Date(offer.starts_at))} · {timeFormat.format(new Date(offer.starts_at))}</Text>
        <Text style={styles.venueName}>{offer.venue_name || offer.location || 'Venue not provided'}</Text>
        <Text style={ui.text}>Expires {dateFormat.format(new Date(offer.expires_at))} at {timeFormat.format(new Date(offer.expires_at))}</Text>
        {!available && <Text style={ui.text}>This invitation is no longer available. Refresh for the latest spots.</Text>}
        <Button label={busy && action?.response === 'accept' ? 'Accepting invitation...' : 'Accept invitation'} disabled={controlsDisabled || !available || !!offersError || !!maintenanceError}
          busy={busy && action?.response === 'accept'} onPress={() => { void respond('offer', offer, 'accept'); }} />
        <Button label={busy && action?.response === 'decline' ? 'Declining invitation...' : 'Decline invitation'} secondary disabled={controlsDisabled || !available || !!offersError || !!maintenanceError}
          busy={busy && action?.response === 'decline'} onPress={() => { void respond('offer', offer, 'decline'); }} />
      </View>;
    })}
    <View style={ui.card}>
      <Text style={ui.heading}>Your weekly plan</Text>
      {scheduleError && <ErrorNotice message={`Unable to refresh your plan: ${scheduleError}`} />}
      {schedule ? <>
        <Text style={ui.text}>{schedule.sports.map(id => SPORTS.find(sport => sport.id === id)?.label ?? id).join(' · ') || 'No sports selected'}</Text>
        {DAYS.map((day, index) => {
          const windows = schedule.slots.filter(slot => slot.day_of_week === index + 1);
          return windows.length > 0 ? <View key={day} style={{ gap: 4 }}><Text style={{ color: colors.ink, fontWeight: '700' }}>{day}</Text>
            <Text style={ui.text}>{windows.map(slot => `${timeLabel(slot.start_time)}–${timeLabel(slot.end_time)}`).join(', ')}</Text></View> : null;
        })}
        {!schedule.slots.length && <Text style={ui.text}>No weekly hours saved yet.</Text>}
        {!ready && schedule.slots.length > 0 && <Text style={ui.text}>Your plan needs attention. Open availability to review the highlighted fields.</Text>}
        {scheduleError && <Text style={ui.text}>This is your last loaded plan.</Text>}
      </> : !scheduleError ? <Text style={ui.text}>Loading saved sports and hours...</Text> : null}
    </View>
    <Text style={[ui.text, { fontSize: 12 }]}>Venue assignments are simulated by RunIt and are not official UMass facility reservations.</Text>
    <View style={styles.footer}>
      <Button label="Edit profile" onPress={onEditProfile} secondary disabled={controlsDisabled} />
      <Button label={signingOut ? 'Signing out...' : 'Sign out'} onPress={onSignOut} secondary disabled={controlsDisabled} busy={signingOut} />
    </View>
  </ScrollView>
  </ScreenEntrance>
  <Modal visible={selectedGameId !== null} animationType={reduceMotion ? 'none' : 'slide'} presentationStyle="fullScreen" backdropColor={colors.paper} onRequestClose={closeDetails}>
    <SafeAreaView style={ui.screen}>
      <GameDetailsScreen game={selectedGame} currentUserId={userId} refreshKey={rosterRefreshKey} now={now} refreshing={loading} disabled={controlsDisabled}
        pendingResponse={action?.key === `game:${selectedGameId}` ? action.response : null}
        readError={error} actionError={actionError} onBack={closeDetails}
        onRefresh={() => { void refresh(); }}
        onRespond={response => { if (selectedGame) void respond('game', selectedGame, response); }} />
    </SafeAreaView>
  </Modal>
  </View>;
}
const createStyles = (colors: Palette) => StyleSheet.create({
  logo: { fontSize: 32, fontWeight: '800', color: colors.green, letterSpacing: -1.5 },
  hero: { borderRadius: 20, backgroundColor: colors.hero, padding: 24, gap: 18, overflow: 'hidden' },
  heroTitle: { fontSize: 30, lineHeight: 36, fontWeight: '700', color: '#FFF', letterSpacing: -1 },
  heroText: { fontSize: 13, color: '#C2D5C6', lineHeight: 20 },
  courtMark: { position: 'absolute', width: 170, height: 170, borderRadius: 85, borderWidth: 1, borderColor: '#D1E1D4', opacity: 0.12, top: -50, right: -55 },
  status: { color: colors.green, backgroundColor: colors.pale, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: '700' },
  date: { fontSize: 16, fontWeight: '600', color: colors.ink },
  venue: { paddingTop: 16, borderTopWidth: 1, borderColor: colors.line, gap: 8 },
  venueName: { fontSize: 17, color: colors.ink, fontWeight: '600' },
  footer: { gap: 10, paddingTop: 4 },
});
