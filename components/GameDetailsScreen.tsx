import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Game } from '../lib/matchmaking';
import { Response } from '../lib/rsvp';
import { SPORTS } from '../lib/schedule';
import GameRsvpActions from './GameRsvpActions';
import GamePlayerList from './GamePlayerList';
import { Button, ErrorNotice, useUI } from './ui';

type Props = {
  game: Game | null;
  currentUserId?: string;
  refreshKey?: number | null;
  now: number;
  refreshing: boolean;
  disabled: boolean;
  pendingResponse: Response | null;
  readError: string | null;
  actionError: string | null;
  onBack: () => void;
  onRefresh: () => void;
  onRespond: (response: Response) => void;
};
const dateFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

export default function GameDetailsScreen({ game, currentUserId, refreshKey, now, refreshing, disabled, pendingResponse, readError, actionError, onBack, onRefresh, onRespond }: Props) {
  const { colors, ui } = useUI();
  const rsvp = game?.rsvp_status === 'accepted' ? 'Going' : game?.rsvp_status === 'pending' ? 'Awaiting your response' : game?.rsvp_status;
  return <ScrollView style={ui.screen} contentContainerStyle={ui.content}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}>
    <Button label="Back to games" secondary onPress={onBack} disabled={pendingResponse !== null} />
    <Text style={ui.eyebrow}>GAME DETAILS</Text>
    {actionError && <ErrorNotice message={actionError} />}
    {readError && <>
      <ErrorNotice message={`Unable to refresh game details: ${readError}`} />
      {game && <Text style={ui.text}>Showing the last loaded details. Refresh before responding.</Text>}
      <Button label="Try again" secondary onPress={onRefresh} disabled={refreshing || disabled} />
    </>}
    {game ? <>
      <Text style={ui.title}>{SPORTS.find(sport => sport.id === game.sport)?.label ?? game.sport}</Text>
      <View style={ui.card}>
        <Text style={ui.eyebrow}>WHEN</Text>
        <Text style={ui.heading}>{dateFormat.format(new Date(game.starts_at))}</Text>
        <Text style={[ui.text, { color: colors.ink, fontSize: 20 }]}>{timeFormat.format(new Date(game.starts_at))}</Text>
        {Date.parse(game.starts_at) <= now && <Text style={ui.text}>The scheduled start time has passed.</Text>}
      </View>
      <View style={ui.card}>
        <Text style={ui.eyebrow}>WHERE</Text>
        <Text style={ui.heading}>{game.venue_name || game.location || 'Venue not provided'}</Text>
        {game.venue_name && game.location && game.location !== game.venue_name && <Text style={ui.text}>{game.location}</Text>}
        <Text style={[ui.text, { fontSize: 12 }]}>Venue assignments are simulated by RunIt and are not official UMass facility reservations.</Text>
      </View>
      <View style={ui.card}>
        <Text style={ui.eyebrow}>PLAYERS</Text>
        <Text style={ui.heading}>{game.player_count} matched player{Number(game.player_count) === 1 ? '' : 's'}</Text>
        <GamePlayerList gameId={game.id} expectedCount={game.player_count} currentUserId={currentUserId} refreshKey={refreshKey} />
      </View>
      <View style={ui.card}>
        <Text style={ui.eyebrow}>YOUR RSVP</Text>
        <Text style={ui.heading}>{rsvp}</Text>
        <GameRsvpActions game={game} now={now} disabled={disabled || !!readError} pendingResponse={pendingResponse} onRespond={onRespond} />
      </View>
    </> : !readError && <View accessibilityLiveRegion="polite" style={ui.card}>
      <Text style={ui.heading}>Game no longer available</Text>
      <Text style={ui.text}>This game is no longer in your upcoming games.</Text>
    </View>}
  </ScrollView>;
}
