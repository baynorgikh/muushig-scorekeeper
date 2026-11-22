/**
 * Pure, immutable game operations. Each returns a new Game object.
 * UI and stores call these; persistence happens elsewhere.
 */
import type { Game, GamePlayer, GameRules, Player, Round, RoundEntry } from '../../types';
import { computeStandings, validatePlayerSelection, validateRound } from '../scoring/engine';
import { snapshotRules } from '../scoring/rules';
import { computeSettlement, isBalanced } from '../settlement/settlement';
import { uid } from '../../utils/id';

const UNDO_LIMIT = 30;

export class GameError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(errors.join(' '));
    this.errors = errors;
  }
}

export interface NewGameInput {
  name: string;
  playedAt: string;
  players: Player[];
  rules: GameRules;
  stake: number;
  booltAmount: number;
}

export function createGame(input: NewGameInput, now = new Date().toISOString()): Game {
  const v = validatePlayerSelection(input.players.map((p) => p.id));
  if (!v.ok) throw new GameError(v.errors);
  if (!(input.stake >= 0) || !(input.booltAmount >= 0)) throw new GameError(['Бооцооны дүн сөрөг байж болохгүй.']);
  const players: GamePlayer[] = input.players.map((p, seat) => ({
    playerId: p.id,
    name: p.name,
    avatar: p.avatar,
    color: p.color,
    seat,
  }));
  return {
    id: uid(),
    name: input.name.trim(),
    playedAt: input.playedAt,
    status: 'active',
    players,
    rules: snapshotRules(input.rules),
    stake: Math.round(input.stake),
    booltAmount: Math.round(input.booltAmount),
    rounds: [],
    undoStack: [],
    settlement: null,
    shared: null,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
    version: 1,
  };
}

export const playerIdsOf = (g: Game) => g.players.map((p) => p.playerId);

export function standingsOf(g: Game, rounds: Round[] = g.rounds) {
  return computeStandings(playerIdsOf(g), rounds, g.rules);
}

function assertActive(g: Game) {
  if (g.status !== 'active') throw new GameError(['Дууссан тоглолтыг өөрчлөх боломжгүй.']);
}

function withRounds(g: Game, rounds: Round[], now: string): Game {
  const undoStack = [...g.undoStack, g.rounds].slice(-UNDO_LIMIT);
  return { ...g, rounds, undoStack, updatedAt: now, version: g.version + 1 };
}

const renumber = (rounds: Round[]) => rounds.map((r, i) => (r.number === i + 1 ? r : { ...r, number: i + 1 }));

export interface RoundDraft {
  /** Optional client id — reusing it makes submission idempotent. */
  id?: string;
  entries: RoundEntry[];
  instantWinPlayerId: string | null;
  note: string;
}

export function addRound(g: Game, draft: RoundDraft, now = new Date().toISOString()): Game {
  assertActive(g);
  // Idempotency: the same round id submitted twice is a no-op.
  if (draft.id && g.rounds.some((r) => r.id === draft.id)) return g;
  const before = standingsOf(g);
  const v = validateRound(draft, g.rules, playerIdsOf(g), before);
  if (!v.ok) throw new GameError(v.errors);
  const round: Round = {
    id: draft.id ?? uid(),
    number: g.rounds.length + 1,
    entries: draft.entries.map((e) => ({ ...e })),
    instantWinPlayerId: draft.instantWinPlayerId,
    note: draft.note.trim(),
    createdAt: now,
    updatedAt: now,
  };
  return withRounds(g, [...g.rounds, round], now);
}

/** Validates the whole sequence after an edit/delete so later rounds stay consistent. */
function validateSequence(g: Game, rounds: Round[]) {
  const ids = playerIdsOf(g);
  for (let i = 0; i < rounds.length; i++) {
    const before = computeStandings(ids, rounds.slice(0, i), g.rules);
    const v = validateRound(rounds[i], g.rules, ids, before);
    if (!v.ok) throw new GameError([`Тойрог ${i + 1}: ${v.errors.join(' ')}`]);
  }
}

export function updateRound(g: Game, roundId: string, draft: RoundDraft, now = new Date().toISOString()): Game {
  assertActive(g);
  const idx = g.rounds.findIndex((r) => r.id === roundId);
  if (idx < 0) throw new GameError(['Тойрог олдсонгүй.']);
  const rounds = g.rounds.map((r, i) =>
    i === idx
      ? { ...r, entries: draft.entries.map((e) => ({ ...e })), instantWinPlayerId: draft.instantWinPlayerId, note: draft.note.trim(), updatedAt: now }
      : r,
  );
  validateSequence(g, rounds);
  return withRounds(g, rounds, now);
}

export function deleteRound(g: Game, roundId: string, now = new Date().toISOString()): Game {
  assertActive(g);
  if (!g.rounds.some((r) => r.id === roundId)) throw new GameError(['Тойрог олдсонгүй.']);
  const rounds = renumber(g.rounds.filter((r) => r.id !== roundId));
  validateSequence(g, rounds);
  return withRounds(g, rounds, now);
}

export function canUndo(g: Game) {
  return g.status === 'active' && g.undoStack.length > 0;
}

export function undo(g: Game, now = new Date().toISOString()): Game {
  assertActive(g);
  if (!g.undoStack.length) throw new GameError(['Буцаах үйлдэл алга.']);
  const undoStack = g.undoStack.slice(0, -1);
  const rounds = g.undoStack[g.undoStack.length - 1];
  return { ...g, rounds, undoStack, updatedAt: now, version: g.version + 1 };
}

export function previewSettlement(g: Game, now?: string) {
  return computeSettlement(
    { playerIds: playerIdsOf(g), rounds: g.rounds, rules: g.rules, stake: g.stake, booltAmount: g.booltAmount },
    now,
  );
}

/** Finalizes the game with the settlement. Must be called only after user confirmation. */
export function finalizeGame(g: Game, now = new Date().toISOString()): Game {
  assertActive(g);
  if (g.rounds.length === 0) throw new GameError(['Нэг ч тойрог бүртгээгүй тоглолтыг дуусгах боломжгүй.']);
  const settlement = previewSettlement(g, now);
  if (!isBalanced(settlement)) throw new GameError(['Тооцоо тэнцэхгүй байна.']);
  return { ...g, status: 'finished', settlement, undoStack: [], finishedAt: now, updatedAt: now, version: g.version + 1 };
}

/** Re-opens a finished game (keeps rules snapshot, clears settlement). */
export function reopenGame(g: Game, now = new Date().toISOString()): Game {
  if (g.status !== 'finished') return g;
  return { ...g, status: 'active', settlement: null, finishedAt: null, updatedAt: now, version: g.version + 1 };
}
