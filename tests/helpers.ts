import type { GameRules, Player, Round, RoundEntry } from '../src/types';
import { DEFAULT_RULES } from '../src/features/scoring/rules';

export const IDS = ['a', 'b', 'c', 'd', 'e'];

export const rules = (over: Partial<GameRules> = {}): GameRules => ({ ...DEFAULT_RULES, ...over });

export function players(ids = IDS): Player[] {
  return ids.map((id) => ({ id, name: id.toUpperCase(), avatar: id, color: '#000', createdAt: '', updatedAt: '' }));
}

type Spec = number | 'p' | 'o' | `${number}b` | `${number}+${number}` | `${number}-${number}`;

/** Compact entry builder: 2 = played with 2 tricks, 'p' = passed, 'o' = out, '0b' = 0 tricks with боолт. */
export function entries(spec: Spec[], ids = IDS): RoundEntry[] {
  return spec.map((s, i) => {
    const playerId = ids[i];
    if (s === 'p') return { playerId, status: 'passed', tricks: 0, boolt: false, adjustment: 0 };
    if (s === 'o') return { playerId, status: 'out', tricks: 0, boolt: false, adjustment: 0 };
    if (typeof s === 'number') return { playerId, status: 'played', tricks: s, boolt: false, adjustment: 0 };
    if (s.endsWith('b')) return { playerId, status: 'played', tricks: Number(s.slice(0, -1)), boolt: true, adjustment: 0 };
    const m = s.match(/^(\d+)([+-]\d+)$/)!;
    return { playerId, status: 'played', tricks: Number(m[1]), boolt: false, adjustment: Number(m[2]) };
  });
}

export function round(n: number, spec: Spec[], instantWinPlayerId: string | null = null): Round {
  return { id: `r${n}`, number: n, entries: entries(spec), instantWinPlayerId, note: '', createdAt: '', updatedAt: '' };
}
