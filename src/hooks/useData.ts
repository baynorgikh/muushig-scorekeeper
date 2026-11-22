import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { getSettings } from '../features/games/gameRepo';

export function usePlayers() {
  return useLiveQuery(() => db.players.orderBy('name').toArray(), []);
}

export function useGames() {
  return useLiveQuery(() => db.games.orderBy('playedAt').reverse().toArray(), []);
}

export function useGame(id: string | undefined) {
  return useLiveQuery(() => (id ? db.games.get(id) : undefined), [id]);
}

export function useSettings() {
  return useLiveQuery(() => getSettings(), []);
}
