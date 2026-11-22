import { describe, expect, it } from 'vitest';
import { computeSettlement, isBalanced, minimizePayments, splitEvenly } from '../src/features/settlement/settlement';
import { IDS, round, rules } from './helpers';
import type { Round } from '../src/types';

const base = { playerIds: IDS, stake: 5000, booltAmount: 5000 };

function finishedFirstOut(): Round[] {
  // start 5: a reaches 0 in round 2
  return [round(1, [3, 1, 1, 0, 0]), round(2, [2, 1, 1, 1, 0])];
}

describe('stake settlement — first_out', () => {
  it('each loser pays the stake to the winner', () => {
    const s = computeSettlement({ ...base, rounds: finishedFirstOut(), rules: rules({ startingPoints: 5 }) });
    expect(s.winnerIds).toEqual(['a']);
    expect(s.players.find((p) => p.playerId === 'a')!.net).toBe(20000);
    for (const id of ['b', 'c', 'd', 'e']) expect(s.players.find((p) => p.playerId === id)!.net).toBe(-5000);
    expect(s.payments).toHaveLength(4);
    expect(s.early).toBe(false);
    expect(isBalanced(s)).toBe(true);
  });

  it('applies the боолт fee to a losing боолт player (default: doubles the stake)', () => {
    const rounds = [round(1, [3, '1b', 1, 0, 0]), round(2, [2, 1, 1, 1, 0])];
    const s = computeSettlement({ ...base, rounds, rules: rules({ startingPoints: 5 }) });
    expect(s.players.find((p) => p.playerId === 'b')!.net).toBe(-10000);
    expect(s.players.find((p) => p.playerId === 'b')!.booltCount).toBe(1);
    expect(s.players.find((p) => p.playerId === 'a')!.net).toBe(25000);
    expect(isBalanced(s)).toBe(true);
  });

  it('ignores боолт in money when booltAffectsMoney is off', () => {
    const rounds = [round(1, [3, '1b', 1, 0, 0]), round(2, [2, 1, 1, 1, 0])];
    const s = computeSettlement({ ...base, rounds, rules: rules({ startingPoints: 5, booltAffectsMoney: false }) });
    expect(s.players.find((p) => p.playerId === 'b')!.net).toBe(-5000);
  });

  it('splits a stake evenly between tied winners without losing a tögrög', () => {
    // start 2: a and b both reach 0 in round 1 → two winners share each stake
    const s = computeSettlement({ ...base, stake: 5001, booltAmount: 0, rounds: [round(1, [2, 2, 1, 0, 0])], rules: rules({ startingPoints: 2 }) });
    expect([...s.winnerIds].sort()).toEqual(['a', 'b']);
    const net = Object.fromEntries(s.players.map((p) => [p.playerId, p.net]));
    expect(net.c).toBe(-5001);
    expect(net.a + net.b).toBe(15003);
    expect(Math.abs(net.a - net.b)).toBeLessThanOrEqual(3);
    expect(isBalanced(s)).toBe(true);
  });

  it('marks an early finalization and uses the lowest score as winner', () => {
    const s = computeSettlement({ ...base, rounds: [round(1, [3, 1, 1, 0, 0])], rules: rules() });
    expect(s.early).toBe(true);
    expect(s.winnerIds).toEqual(['a']);
    expect(isBalanced(s)).toBe(true);
  });
});

describe('stake settlement — last_remaining', () => {
  it('the last player pays each other player the stake', () => {
    const r = rules({ startingPoints: 2, endCondition: 'last_remaining' });
    const rounds = [round(1, [2, 2, 1, 0, 0]), round(2, ['o', 'o', 1, 2, 2]), round(3, ['o', 'o', 'o', 5, 0])];
    const s = computeSettlement({ ...base, rounds, rules: r });
    expect(s.loserIds).toEqual(['e']);
    expect(s.players.find((p) => p.playerId === 'e')!.net).toBe(-20000);
    for (const id of ['a', 'b', 'c', 'd']) expect(s.players.find((p) => p.playerId === id)!.net).toBe(5000);
    expect(isBalanced(s)).toBe(true);
  });
});

describe('points settlement', () => {
  it('settles pairwise by point difference and balances', () => {
    const r = rules({ settlementMode: 'points', pointValue: 1000 });
    const s = computeSettlement({ ...base, rounds: [round(1, [2, 1, 1, 1, 0])], rules: r });
    // totals: a13 b14 c14 d14 e20 ; S = 75 ; net_i = (S - 5 p_i) * 1000
    expect(s.players.find((p) => p.playerId === 'a')!.net).toBe(10000);
    expect(s.players.find((p) => p.playerId === 'e')!.net).toBe(-25000);
    expect(isBalanced(s)).toBe(true);
  });
});

describe('payment minimization', () => {
  it('uses at most n-1 payments and reproduces nets exactly', () => {
    const nets = { a: 30000, b: -10000, c: -5000, d: -15000, e: 0 };
    const p = minimizePayments(nets);
    expect(p.length).toBeLessThanOrEqual(4);
    const check: Record<string, number> = { a: 0, b: 0, c: 0, d: 0, e: 0 };
    for (const x of p) {
      check[x.from] -= x.amount;
      check[x.to] += x.amount;
    }
    expect(check).toEqual(nets);
  });

  it('collapses chains: A owes B, B owes C → A pays C directly', () => {
    const p = minimizePayments({ a: -100, b: 0, c: 100 });
    expect(p).toEqual([{ from: 'a', to: 'c', amount: 100 }]);
  });

  it('splitEvenly keeps the exact total', () => {
    expect(splitEvenly(10001, 3)).toEqual([3334, 3334, 3333]);
    expect(splitEvenly(10001, 3).reduce((a, b) => a + b, 0)).toBe(10001);
  });
});

describe('settlement always balances (property test)', () => {
  it('Σ net = 0 for random games', () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let trial = 0; trial < 300; trial++) {
      const r = rules({
        endCondition: rnd() < 0.5 ? 'first_out' : 'last_remaining',
        settlementMode: rnd() < 0.7 ? 'stake' : 'points',
        enforceTrickTotal: false,
        startingPoints: 3 + Math.floor(rnd() * 10),
        pointValue: 1 + Math.floor(rnd() * 1000),
      });
      const rounds: Round[] = [];
      for (let n = 1; n <= 1 + Math.floor(rnd() * 8); n++) {
        rounds.push({
          id: `r${n}`,
          number: n,
          instantWinPlayerId: null,
          note: '',
          createdAt: '',
          updatedAt: '',
          entries: IDS.map((playerId) => ({ playerId, status: 'played' as const, tricks: Math.floor(rnd() * 3), boolt: rnd() < 0.2, adjustment: 0 })),
        });
      }
      const s = computeSettlement({ playerIds: IDS, rounds, rules: r, stake: Math.floor(rnd() * 20000), booltAmount: Math.floor(rnd() * 9999) });
      expect(s.players.reduce((a, p) => a + p.net, 0)).toBe(0);
      expect(isBalanced(s)).toBe(true);
    }
  });
});
