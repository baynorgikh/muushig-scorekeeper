/**
 * Core domain types for Muushig Scorekeeper.
 * All monetary amounts are integers in Mongolian tögrög (₮).
 */

export const PLAYERS_PER_GAME = 5 as const;

export interface Player {
  id: string;
  name: string;
  /** Emoji or short text avatar, or a data: URL of an uploaded photo. */
  avatar: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  /** Set when the player has been synced to Supabase. */
  remoteSyncedAt?: string | null;
}

/**
 * How a game ends.
 * - first_out: the first player to reach the target score wins and the game ends.
 * - last_remaining: players "go out" when they reach the target; the game ends when
 *   only one player remains — that player loses.
 */
export type EndCondition = 'first_out' | 'last_remaining';

/**
 * How money is settled.
 * - stake: losers pay the starting stake (+ боолт fees) to the winner(s).
 * - points: everyone settles pairwise by point difference × pointValue.
 */
export type SettlementMode = 'stake' | 'points';

export interface GameRules {
  /** Points every player starts with. */
  startingPoints: number;
  /** Points subtracted for each trick taken. */
  pointsPerTrick: number;
  /** Points added when a player plays the round but takes no trick. */
  noTrickPenalty: number;
  /** Points added when a player passes (сугарах) a round. */
  passPenalty: number;
  /** Number of tricks in one round (5 cards → 5 tricks). */
  tricksPerRound: number;
  /** Require the tricks of all playing players to add up to tricksPerRound. */
  enforceTrickTotal: boolean;
  /** Боолт multiplier — default 2x. */
  booltMultiplier: number;
  /** Multiply the боолт player's round points by booltMultiplier. */
  booltAffectsPoints: boolean;
  /** Add the боолт fee to the money a losing боолт player pays. */
  booltAffectsMoney: boolean;
  endCondition: EndCondition;
  /** A player reaching this score (or below) goes out. */
  targetScore: number;
  /** Дөрвөн тамга: four cards of one suit → instant win. Off by default. */
  fourSuitInstantWin: boolean;
  /** Allow a manual +/- point adjustment per player per round. */
  allowManualAdjust: boolean;
  settlementMode: SettlementMode;
  /** ₮ per point — used only by the "points" settlement mode. */
  pointValue: number;
}

export type EntryStatus = 'played' | 'passed' | 'out';

export interface RoundEntry {
  playerId: string;
  status: EntryStatus;
  tricks: number;
  boolt: boolean;
  /** Manual point adjustment (added after multipliers). */
  adjustment: number;
}

export interface Round {
  id: string;
  number: number;
  entries: RoundEntry[];
  /** Player who triggered the дөрвөн тамга instant win this round, if any. */
  instantWinPlayerId: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface GamePlayer {
  playerId: string;
  name: string;
  avatar: string;
  color: string;
  seat: number;
}

export interface Payment {
  from: string;
  to: string;
  amount: number;
}

export interface PlayerSettlement {
  playerId: string;
  finalPoints: number;
  booltCount: number;
  pays: number;
  receives: number;
  net: number;
}

export interface Settlement {
  players: PlayerSettlement[];
  payments: Payment[];
  winnerIds: string[];
  loserIds: string[];
  /** True when the game was finalized before the normal end condition. */
  early: boolean;
  computedAt: string;
}

export type GameStatus = 'active' | 'finished';

export interface SharedInfo {
  code: string;
  remoteId: string;
  role: 'host' | 'viewer';
}

export interface Game {
  id: string;
  name: string;
  /** ISO date-time the game is played. */
  playedAt: string;
  status: GameStatus;
  players: GamePlayer[];
  /** Immutable snapshot of the rules at game creation. */
  rules: GameRules;
  stake: number;
  booltAmount: number;
  rounds: Round[];
  /** Previous `rounds` arrays for undo (most recent last). */
  undoStack: Round[][];
  settlement: Settlement | null;
  shared: SharedInfo | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  /** Incremented on every change; used for conflict handling in sync. */
  version: number;
}

export interface AppSettings {
  id: 'app';
  defaultRules: GameRules;
  defaultStake: number;
  defaultBooltAmount: number;
}

export type OutboxKind = 'upsert_game';

export interface OutboxItem {
  id: string;
  kind: OutboxKind;
  entityId: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
}
