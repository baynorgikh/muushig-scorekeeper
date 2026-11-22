/**
 * Converts between the local Game document and the Supabase relational schema.
 * Pure functions — tested in tests/mapping.test.ts.
 */
import type { EntryStatus, Game, GameRules, Round } from '../../types';
import { entryDelta } from '../scoring/engine';
import { DEFAULT_RULES } from '../scoring/rules';

export interface SyncPayload {
  game: {
    id: string;
    join_code: string;
    name: string;
    played_at: string;
    status: string;
    stake: number;
    boolt_amount: number;
    version: number;
    finished_at: string | null;
    updated_at: string;
  };
  rules: GameRules;
  players: { player_id: string; seat: number; name: string; avatar: string; color: string }[];
  rounds: {
    id: string;
    number: number;
    instant_win_player_id: string | null;
    note: string;
    created_at: string;
    updated_at: string;
    results: { player_id: string; status: EntryStatus; tricks: number; boolt: boolean; adjustment: number; delta: number }[];
  }[];
  settlement: null | {
    winner_ids: string[];
    loser_ids: string[];
    early: boolean;
    computed_at: string;
    players: unknown;
    payments: { from_player: string; to_player: string; amount: number }[];
  };
}

/** Avatars that are uploaded photos are not sent to the server (size); an emoji fallback is used. */
const slimAvatar = (a: string) => (a.startsWith('data:') ? '🂠' : a);

export function toSyncPayload(game: Game): SyncPayload {
  if (!game.shared) throw new Error('Хуваалцсан тоглолт биш байна.');
  return {
    game: {
      id: game.shared.remoteId,
      join_code: game.shared.code,
      name: game.name,
      played_at: game.playedAt,
      status: game.status,
      stake: game.stake,
      boolt_amount: game.booltAmount,
      version: game.version,
      finished_at: game.finishedAt,
      updated_at: game.updatedAt,
    },
    rules: game.rules,
    players: game.players.map((p) => ({ player_id: p.playerId, seat: p.seat, name: p.name, avatar: slimAvatar(p.avatar), color: p.color })),
    rounds: game.rounds.map((r) => ({
      id: r.id,
      number: r.number,
      instant_win_player_id: r.instantWinPlayerId,
      note: r.note,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
      results: r.entries.map((e) => ({ ...e, player_id: e.playerId, delta: entryDelta(e, game.rules) })).map(({ playerId: _p, ...rest }) => {
        void _p;
        return rest;
      }),
    })),
    settlement: game.settlement
      ? {
          winner_ids: game.settlement.winnerIds,
          loser_ids: game.settlement.loserIds,
          early: game.settlement.early,
          computed_at: game.settlement.computedAt,
          players: game.settlement.players,
          payments: game.settlement.payments.map((p) => ({ from_player: p.from, to_player: p.to, amount: p.amount })),
        }
      : null,
  };
}

/* Shapes returned by the select query in sync.ts */
export interface RemoteGameRow {
  id: string;
  join_code: string;
  name: string;
  played_at: string;
  status: 'active' | 'finished';
  stake: number;
  boolt_amount: number;
  version: number;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
  game_rules: { rules: GameRules } | { rules: GameRules }[] | null;
  game_players: { player_id: string; seat: number; name: string; avatar: string; color: string }[];
  rounds: {
    id: string;
    number: number;
    instant_win_player_id: string | null;
    note: string | null;
    created_at: string;
    updated_at: string;
    round_results: { player_id: string; status: EntryStatus; tricks: number; boolt: boolean; adjustment: number }[];
  }[];
  /** One-to-one relation; PostgREST may return an object or a single-item array. */
  settlements: unknown;
  settlement_payments: { from_player: string; to_player: string; amount: number }[];
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** Builds a read-only local Game (viewer copy) from the remote rows. */
export function fromRemote(row: RemoteGameRow, localId: string, role: 'host' | 'viewer'): Game {
  const rulesRow = one(row.game_rules);
  const rules = { ...DEFAULT_RULES, ...rulesRow?.rules };
  const players = [...row.game_players].sort((a, b) => a.seat - b.seat).map((p) => ({ playerId: p.player_id, seat: p.seat, name: p.name, avatar: p.avatar, color: p.color }));
  const order = new Map(players.map((p, i) => [p.playerId, i]));
  const rounds: Round[] = [...row.rounds]
    .sort((a, b) => a.number - b.number)
    .map((r) => ({
      id: r.id,
      number: r.number,
      instantWinPlayerId: r.instant_win_player_id,
      note: r.note ?? '',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      entries: [...r.round_results]
        .sort((a, b) => (order.get(a.player_id) ?? 0) - (order.get(b.player_id) ?? 0))
        .map((e) => ({ playerId: e.player_id, status: e.status, tricks: e.tricks, boolt: e.boolt, adjustment: Number(e.adjustment) || 0 })),
    }));
  const s = one(row.settlements as never) as null | { winner_ids: string[]; loser_ids: string[]; early: boolean; computed_at: string; players: NonNullable<Game['settlement']>['players'] };
  return {
    id: localId,
    name: row.name,
    playedAt: row.played_at,
    status: row.status,
    players,
    rules,
    stake: Number(row.stake),
    booltAmount: Number(row.boolt_amount),
    rounds,
    undoStack: [],
    settlement: s
      ? {
          winnerIds: s.winner_ids,
          loserIds: s.loser_ids,
          early: s.early,
          computedAt: s.computed_at,
          players: s.players,
          payments: row.settlement_payments.map((p) => ({ from: p.from_player, to: p.to_player, amount: Number(p.amount) })),
        }
      : null,
    shared: { code: row.join_code, remoteId: row.id, role },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
    version: row.version,
  };
}
