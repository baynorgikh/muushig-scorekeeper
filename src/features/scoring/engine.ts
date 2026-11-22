/**
 * Pure scoring engine. No React, no I/O. Every function here is deterministic
 * and covered by tests in /tests.
 */
import { PLAYERS_PER_GAME } from '../../types';
import type { GameRules, Round, RoundEntry } from '../../types';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/** A game must have exactly five distinct players. */
export function validatePlayerSelection(playerIds: string[]): ValidationResult {
  const errors: string[] = [];
  const unique = new Set(playerIds.filter(Boolean));
  if (playerIds.length !== PLAYERS_PER_GAME) {
    errors.push(`Яг ${PLAYERS_PER_GAME} тоглогч сонгоно уу (одоо ${playerIds.length}).`);
  }
  if (unique.size !== playerIds.length) {
    errors.push('Нэг тоглогчийг давхар сонгож болохгүй.');
  }
  return { ok: errors.length === 0, errors };
}

/** Base points change for one entry, before боолт multiplier and adjustment. */
export function baseDelta(entry: RoundEntry, rules: GameRules): number {
  switch (entry.status) {
    case 'out':
      return 0;
    case 'passed':
      return rules.passPenalty;
    case 'played':
      return entry.tricks > 0 ? -entry.tricks * rules.pointsPerTrick : rules.noTrickPenalty;
  }
}

/** Final points change for one entry in a round. */
export function entryDelta(entry: RoundEntry, rules: GameRules): number {
  if (entry.status === 'out') return 0;
  let delta = baseDelta(entry, rules);
  if (entry.boolt && rules.booltAffectsPoints) delta *= rules.booltMultiplier;
  if (rules.allowManualAdjust) delta += entry.adjustment || 0;
  return delta;
}

export function roundDeltas(round: Round, rules: GameRules): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of round.entries) out[e.playerId] = entryDelta(e, rules);
  return out;
}

/** The round winner: instant-win player, otherwise the player with the most tricks (null on a tie). */
export function roundWinner(round: Round): string | null {
  if (round.instantWinPlayerId) return round.instantWinPlayerId;
  let best: string | null = null;
  let bestTricks = 0;
  let tie = false;
  for (const e of round.entries) {
    if (e.status !== 'played') continue;
    if (e.tricks > bestTricks) {
      best = e.playerId;
      bestTricks = e.tricks;
      tie = false;
    } else if (e.tricks === bestTricks && bestTricks > 0) {
      tie = true;
    }
  }
  return tie ? null : best;
}

export interface Standings {
  totals: Record<string, number>;
  /** Running totals after each round, index-aligned with rounds. */
  history: Record<string, number>[];
  /** Players who have gone out, in order. */
  outOrder: string[];
  /** Round number each player went out in. */
  outAtRound: Record<string, number>;
  finished: boolean;
  /** Round number on which the game finished. */
  finishedAtRound: number | null;
  winnerIds: string[];
  loserIds: string[];
  booltCounts: Record<string, number>;
}

/**
 * Replays all rounds and returns current totals and the game outcome.
 * Rounds recorded after the game finished are ignored (and rejected by validateRound).
 */
export function computeStandings(playerIds: string[], rounds: Round[], rules: GameRules): Standings {
  const totals: Record<string, number> = {};
  const booltCounts: Record<string, number> = {};
  for (const id of playerIds) {
    totals[id] = rules.startingPoints;
    booltCounts[id] = 0;
  }
  const history: Record<string, number>[] = [];
  const outOrder: string[] = [];
  const outAtRound: Record<string, number> = {};
  let finished = false;
  let finishedAtRound: number | null = null;
  let winnerIds: string[] = [];
  let loserIds: string[] = [];

  const sorted = [...rounds].sort((a, b) => a.number - b.number);
  for (const round of sorted) {
    if (finished) break;
    for (const e of round.entries) {
      if (!(e.playerId in totals) || outAtRound[e.playerId] !== undefined) continue;
      totals[e.playerId] += entryDelta(e, rules);
      if (e.boolt && e.status !== 'out') booltCounts[e.playerId] += 1;
    }

    // Who goes out this round.
    const newlyOut: string[] = [];
    const instant =
      rules.fourSuitInstantWin && round.instantWinPlayerId && round.instantWinPlayerId in totals
        ? round.instantWinPlayerId
        : null;

    if (instant && outAtRound[instant] === undefined) {
      newlyOut.push(instant);
    }
    for (const id of playerIds) {
      if (outAtRound[id] !== undefined || newlyOut.includes(id)) continue;
      if (totals[id] <= rules.targetScore) newlyOut.push(id);
    }
    // Lower score goes out first when several cross in the same round.
    newlyOut.sort((a, b) => (a === instant ? -1 : b === instant ? 1 : totals[a] - totals[b]));
    for (const id of newlyOut) {
      outOrder.push(id);
      outAtRound[id] = round.number;
    }

    if (rules.endCondition === 'first_out' || instant) {
      if (newlyOut.length > 0) {
        finished = true;
        finishedAtRound = round.number;
        if (instant) {
          winnerIds = [instant];
        } else {
          const best = Math.min(...newlyOut.map((id) => totals[id]));
          winnerIds = newlyOut.filter((id) => totals[id] === best);
        }
        loserIds = playerIds.filter((id) => !winnerIds.includes(id));
      }
    } else {
      const remaining = playerIds.filter((id) => outAtRound[id] === undefined);
      if (remaining.length <= 1) {
        finished = true;
        finishedAtRound = round.number;
        if (remaining.length === 1) {
          loserIds = remaining;
        } else {
          // Everyone left went out in the same round: the highest score among them loses.
          const worst = Math.max(...newlyOut.map((id) => totals[id]));
          loserIds = newlyOut.filter((id) => totals[id] === worst);
        }
        winnerIds = playerIds.filter((id) => !loserIds.includes(id));
      }
    }
    history.push({ ...totals });
  }

  return { totals, history, outOrder, outAtRound, finished, finishedAtRound, winnerIds, loserIds, booltCounts };
}

/**
 * Provisional outcome for a game that is being finalized before the normal
 * end condition: lowest score wins (first_out) / highest score loses (last_remaining).
 */
export function provisionalOutcome(
  playerIds: string[],
  standings: Standings,
  rules: GameRules,
): { winnerIds: string[]; loserIds: string[] } {
  if (standings.finished) return { winnerIds: standings.winnerIds, loserIds: standings.loserIds };
  const t = standings.totals;
  if (rules.endCondition === 'first_out') {
    const best = Math.min(...playerIds.map((id) => t[id]));
    const winnerIds = playerIds.filter((id) => t[id] === best);
    return { winnerIds, loserIds: playerIds.filter((id) => !winnerIds.includes(id)) };
  }
  const remaining = playerIds.filter((id) => standings.outAtRound[id] === undefined);
  const pool = remaining.length ? remaining : playerIds;
  const worst = Math.max(...pool.map((id) => t[id]));
  const loserIds = pool.filter((id) => t[id] === worst);
  return { winnerIds: playerIds.filter((id) => !loserIds.includes(id)), loserIds };
}

/** Validates a round against the rules and the standings before it. */
export function validateRound(
  round: Pick<Round, 'entries' | 'instantWinPlayerId'>,
  rules: GameRules,
  playerIds: string[],
  before: Standings,
): ValidationResult {
  const errors: string[] = [];
  if (before.finished) errors.push('Тоглолт аль хэдийн дууссан тул шинэ тойрог нэмэх боломжгүй.');
  if (round.entries.length !== PLAYERS_PER_GAME) errors.push(`Тойрогт яг ${PLAYERS_PER_GAME} тоглогч байх ёстой.`);
  const ids = new Set(round.entries.map((e) => e.playerId));
  if (ids.size !== round.entries.length || playerIds.some((id) => !ids.has(id))) {
    errors.push('Тойргийн тоглогчид тоглолтын тоглогчидтой таарахгүй байна.');
  }

  let trickSum = 0;
  let playedCount = 0;
  for (const e of round.entries) {
    const wentOut = before.outAtRound[e.playerId] !== undefined;
    if (wentOut && e.status !== 'out') errors.push('Гарсан тоглогч дахин тоглох боломжгүй.');
    if (!wentOut && e.status === 'out') errors.push('Гараагүй тоглогчийг "гарсан" гэж тэмдэглэх боломжгүй.');
    if (e.boolt && e.status === 'out') errors.push('Гарсан тоглогч боолт хийх боломжгүй.');
    if (e.boolt && e.status !== 'played') errors.push('Зөвхөн тоглож буй тоглогч боолт хийнэ.');
    if (!Number.isInteger(e.tricks) || e.tricks < 0 || e.tricks > rules.tricksPerRound) {
      errors.push(`Мөрийн тоо 0–${rules.tricksPerRound} хооронд байна.`);
    }
    if (e.status !== 'played' && e.tricks > 0) errors.push('Тоглоогүй тоглогч мөр авах боломжгүй.');
    if (!rules.allowManualAdjust && e.adjustment) errors.push('Гар засвар энэ дүрмээр хаалттай.');
    if (!Number.isFinite(e.adjustment)) errors.push('Засварын утга буруу.');
    if (e.status === 'played') {
      playedCount += 1;
      trickSum += e.tricks;
    }
  }

  if (round.instantWinPlayerId) {
    if (!rules.fourSuitInstantWin) errors.push('Дөрвөн тамгын дүрэм идэвхгүй байна.');
    else if (!ids.has(round.instantWinPlayerId) || before.outAtRound[round.instantWinPlayerId] !== undefined) {
      errors.push('Дөрвөн тамга барьсан тоглогч буруу байна.');
    }
  } else if (rules.enforceTrickTotal && playedCount > 0 && trickSum !== rules.tricksPerRound) {
    errors.push(`Тоглосон тоглогчдын мөрийн нийлбэр ${rules.tricksPerRound} байх ёстой (одоо ${trickSum}).`);
  }
  if (!round.instantWinPlayerId && playedCount === 0) errors.push('Дор хаяж нэг тоглогч тоглосон байх ёстой.');

  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

/** Builds a blank round for the next round number. */
export function blankEntries(playerIds: string[], before: Standings): RoundEntry[] {
  return playerIds.map((playerId) => ({
    playerId,
    status: before.outAtRound[playerId] !== undefined ? 'out' : 'played',
    tricks: 0,
    boolt: false,
    adjustment: 0,
  }));
}
