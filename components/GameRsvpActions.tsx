import React from 'react';
import { Game } from '../lib/matchmaking';
import { Response, canRespondToGame } from '../lib/rsvp';
import { Button } from './ui';

type Props = {
  game: Game;
  now: number;
  disabled: boolean;
  pendingResponse: Response | null;
  onRespond: (response: Response) => void;
};

// Home and game details share the same rules and submission state.
export default function GameRsvpActions({ game, now, disabled, pendingResponse, onRespond }: Props) {
  return <>
    {game.rsvp_status === 'pending' && <Button label={pendingResponse === 'accept' ? 'Accepting...' : 'Accept game'}
      disabled={disabled || pendingResponse !== null || !canRespondToGame(game.rsvp_status, game.starts_at, 'accept', now)}
      busy={pendingResponse === 'accept'} onPress={() => onRespond('accept')} />}
    {(game.rsvp_status === 'pending' || game.rsvp_status === 'accepted') && <Button label={pendingResponse === 'decline' ? 'Declining...' : 'Decline game'} danger
      disabled={disabled || pendingResponse !== null || !canRespondToGame(game.rsvp_status, game.starts_at, 'decline', now)}
      busy={pendingResponse === 'decline'} onPress={() => onRespond('decline')} />}
  </>;
}
