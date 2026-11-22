/**
 * Pure money settlement engine.
 * Invariant (tested): the sum of all player nets is exactly 0, and the
 * payments list moves exactly those nets.
 */
import type { GameRules, Payment, PlayerSettlement, Settlement } from '../../types';
import { computeStandings, provisionalOutcome } from '../scoring/engine';
import type { Round } from '../../types';

export interface SettlementInput {
  playerIds: string[];
  rounds: Round[];
  rules: GameRules;
  stake: number;
  booltAmount: number;
}

/** Splits `amount` into `parts` integer shares that sum to `amount` exactly. */
export function splitEvenly(amount: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(amount / parts);
  const rest = amount - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rest ? 1 : 0));
}

/**
 * Turns net balances into the fewest practical payments using a greedy
 * largest-debtor → largest-creditor match. This yields at most n − 1 payments.
 */
export function minimizePayments(nets: Record<string, number>): Payment[] {
  const creditors = Object.entries(nets)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, v }));
  const debtors = Object.entries(nets)
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, v: -v }));
  const payments: Payment[] = [];
  const byAmount = (a: { v: number; id: string }, b: { v: number; id: string }) => b.v - a.v || a.id.localeCompare(b.id);
  while (creditors.length && debtors.length) {
    creditors.sort(byAmount);
    debtors.sort(byAmount);
    const c = creditors[0];
    const d = debtors[0];
    const amount = Math.min(c.v, d.v);
    if (amount > 0) payments.push({ from: d.id, to: c.id, amount });
    c.v -= amount;
    d.v -= amount;
    if (c.v === 0) creditors.shift();
    if (d.v === 0) debtors.shift();
  }
  return payments;
}

/** Raw obligations (who owes whom, before minimization). */
export function rawObligations(input: SettlementInput, winnerIds: string[], loserIds: string[], booltCounts: Record<string, number>, totals: Record<string, number>): Payment[] {
  const { rules, stake, booltAmount, playerIds } = input;
  const out: Payment[] = [];

  if (rules.settlementMode === 'points') {
    // Pairwise: for every pair, the higher score pays the lower score the difference × pointValue.
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        const a = playerIds[i];
        const b = playerIds[j];
        const diff = totals[a] - totals[b];
        if (diff > 0) out.push({ from: a, to: b, amount: Math.round(diff * rules.pointValue) });
        else if (diff < 0) out.push({ from: b, to: a, amount: Math.round(-diff * rules.pointValue) });
      }
    }
    return out.filter((p) => p.amount > 0);
  }

  const fee = (id: string) => stake + (rules.booltAffectsMoney ? booltAmount * (booltCounts[id] ?? 0) : 0);

  if (rules.endCondition === 'first_out') {
    // Each loser pays their stake (+ боолт fees), split evenly among the winners.
    for (const loser of loserIds) {
      const shares = splitEvenly(fee(loser), winnerIds.length);
      winnerIds.forEach((w, i) => shares[i] > 0 && out.push({ from: loser, to: w, amount: shares[i] }));
    }
  } else {
    // Each loser pays every other player their stake (+ the loser's боолт fees).
    for (const loser of loserIds) {
      for (const w of winnerIds) {
        const amount = fee(loser);
        if (amount > 0) out.push({ from: loser, to: w, amount });
      }
    }
  }
  return out;
}

export function computeSettlement(input: SettlementInput, now = new Date().toISOString()): Settlement {
  const { playerIds, rounds, rules } = input;
  const standings = computeStandings(playerIds, rounds, rules);
  const { winnerIds, loserIds } = provisionalOutcome(playerIds, standings, rules);
  const obligations = rawObligations(input, winnerIds, loserIds, standings.booltCounts, standings.totals);

  const nets: Record<string, number> = Object.fromEntries(playerIds.map((id) => [id, 0]));
  for (const p of obligations) {
    nets[p.from] -= p.amount;
    nets[p.to] += p.amount;
  }
  const payments = minimizePayments(nets);

  const players: PlayerSettlement[] = playerIds.map((id) => {
    const pays = payments.filter((p) => p.from === id).reduce((s, p) => s + p.amount, 0);
    const receives = payments.filter((p) => p.to === id).reduce((s, p) => s + p.amount, 0);
    return {
      playerId: id,
      finalPoints: standings.totals[id],
      booltCount: standings.booltCounts[id],
      pays,
      receives,
      net: receives - pays,
    };
  });

  return { players, payments, winnerIds, loserIds, early: !standings.finished, computedAt: now };
}

/** Checks the settlement invariant: Σ net = 0 and payments reproduce the nets. */
export function isBalanced(s: Settlement): boolean {
  const sum = s.players.reduce((acc, p) => acc + p.net, 0);
  const paid = s.payments.reduce((acc, p) => acc + p.amount, 0);
  const received = s.players.reduce((acc, p) => acc + p.receives, 0);
  return sum === 0 && paid === received;
}
