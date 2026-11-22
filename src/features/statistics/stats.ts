/** Pure statistics over finished games. */
import type { Game } from '../../types';

export type RangeKey = 'today' | 'week' | 'month' | 'all' | 'custom';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export function rangeFor(key: RangeKey, now = new Date(), custom?: { from?: string; to?: string }): DateRange {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  switch (key) {
    case 'today':
      return { from: start, to: null };
    case 'week': {
      // Week starts on Monday.
      const day = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - day);
      return { from: start, to: null };
    }
    case 'month':
      start.setDate(1);
      return { from: start, to: null };
    case 'custom': {
      const from = custom?.from ? new Date(`${custom.from}T00:00:00`) : null;
      const to = custom?.to ? new Date(`${custom.to}T23:59:59.999`) : null;
      return { from, to };
    }
    default:
      return { from: null, to: null };
  }
}

export function inRange(iso: string, r: DateRange): boolean {
  const t = new Date(iso).getTime();
  if (r.from && t < r.from.getTime()) return false;
  if (r.to && t > r.to.getTime()) return false;
  return true;
}

export interface PlayerStats {
  playerId: string;
  name: string;
  avatar: string;
  color: string;
  games: number;
  wins: number;
  losses: number;
  net: number;
  winRate: number;
  avgResult: number;
  best: number;
  worst: number;
}

export interface Summary {
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  /** Sum of positive results — total money that changed hands. */
  moneyMoved: number;
  players: PlayerStats[];
  biggestWinner: PlayerStats | null;
  biggestLoser: PlayerStats | null;
}

const finished = (games: Game[]) => games.filter((g) => g.status === 'finished' && g.settlement);

/**
 * A player "wins" a game if they are in the settlement's winner list,
 * "loses" if they are in the loser list.
 */
export function computeSummary(games: Game[], range: DateRange = { from: null, to: null }): Summary {
  const list = finished(games).filter((g) => inRange(g.playedAt, range));
  const map = new Map<string, PlayerStats>();
  let totalWins = 0;
  let totalLosses = 0;
  let moneyMoved = 0;

  for (const g of list) {
    const s = g.settlement!;
    for (const gp of g.players) {
      const ps = s.players.find((p) => p.playerId === gp.playerId);
      const net = ps?.net ?? 0;
      let row = map.get(gp.playerId);
      if (!row) {
        row = { playerId: gp.playerId, name: gp.name, avatar: gp.avatar, color: gp.color, games: 0, wins: 0, losses: 0, net: 0, winRate: 0, avgResult: 0, best: -Infinity, worst: Infinity };
        map.set(gp.playerId, row);
      }
      row.name = gp.name;
      row.games += 1;
      row.net += net;
      row.best = Math.max(row.best, net);
      row.worst = Math.min(row.worst, net);
      if (s.winnerIds.includes(gp.playerId)) {
        row.wins += 1;
        totalWins += 1;
      }
      if (s.loserIds.includes(gp.playerId)) {
        row.losses += 1;
        totalLosses += 1;
      }
      if (net > 0) moneyMoved += net;
    }
  }

  const players = [...map.values()].map((r) => ({
    ...r,
    winRate: r.games ? r.wins / r.games : 0,
    avgResult: r.games ? Math.round(r.net / r.games) : 0,
    best: Number.isFinite(r.best) ? r.best : 0,
    worst: Number.isFinite(r.worst) ? r.worst : 0,
  }));
  players.sort((a, b) => b.net - a.net || b.winRate - a.winRate || a.name.localeCompare(b.name));

  const biggestWinner = players.length && players[0].net > 0 ? players[0] : null;
  const last = players[players.length - 1];
  const biggestLoser = players.length && last.net < 0 ? last : null;

  return { totalGames: list.length, totalWins, totalLosses, moneyMoved, players, biggestWinner, biggestLoser };
}

/** Cumulative profit/loss per player over time (one point per finished game). */
export function profitOverTime(games: Game[], range: DateRange, playerIds: string[]) {
  const list = finished(games)
    .filter((g) => inRange(g.playedAt, range))
    .sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  const running: Record<string, number> = Object.fromEntries(playerIds.map((id) => [id, 0]));
  return list.map((g) => {
    for (const p of g.settlement!.players) if (p.playerId in running) running[p.playerId] += p.net;
    return { date: g.playedAt.slice(0, 10), label: g.name || g.playedAt.slice(0, 10), ...running };
  });
}

export function monthlyGameCount(games: Game[], range: DateRange) {
  const counts = new Map<string, number>();
  for (const g of finished(games).filter((g) => inRange(g.playedAt, range))) {
    const key = g.playedAt.slice(0, 7);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
}

/** Per-player career stats over all finished games. */
export function playerCareer(games: Game[], playerId: string): PlayerStats | null {
  return computeSummary(games).players.find((p) => p.playerId === playerId) ?? null;
}
