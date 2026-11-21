import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GamePlayer, loadGamePlayers } from '../lib/players';
import { errorMessage } from '../lib/schedule';
import { Button, ErrorNotice, useUI } from './ui';

type Props = { gameId: string; expectedCount: number; currentUserId?: string; refreshKey?: number | null };

export default function GamePlayerList({ gameId, expectedCount, currentUserId, refreshKey }: Props) {
  const { colors, ui } = useUI();
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setPlayers([]);
    loadGamePlayers(gameId).then(data => { if (active) setPlayers(data); })
      .catch(error => { if (active) setError(errorMessage(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [gameId, refreshKey, retry]);
  const named = players.filter(player => player.display_name || player.username);
  if (loading) return <ActivityIndicator color={colors.green} accessibilityLabel="Loading player names" />;
  if (error) return <>
    <ErrorNotice message={`Unable to load player names: ${error}`} />
    <Button label="Retry player names" secondary onPress={() => setRetry(value => value + 1)} />
  </>;
  return <View style={{ gap: 12 }}>
    {named.map(player => <View key={player.user_id} style={[ui.row, { paddingTop: 12, borderTopWidth: 1, borderColor: colors.line, alignItems: 'flex-start' }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={ui.label}>{player.display_name || `@${player.username}`}{player.user_id === currentUserId ? ' (you)' : ''}</Text>
        {player.display_name && player.username && <Text style={ui.text}>@{player.username}</Text>}
      </View>
      <Text style={[ui.text, { color: player.rsvp_status === 'accepted' ? colors.green : colors.muted }]}>{player.rsvp_status === 'accepted' ? 'Going' : 'Pending RSVP'}</Text>
    </View>)}
    {!named.length ? <Text style={ui.text}>Player names are not available for this game.</Text>
      : named.length < Math.max(Number(expectedCount), players.length) && <Text style={ui.text}>Some player names are unavailable.</Text>}
  </View>;
}
