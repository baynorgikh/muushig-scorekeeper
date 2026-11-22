/**
 * Integration: real Dexie (fake-indexeddb) + repositories + game operations,
 * i.e. the same code paths the UI uses to create, play and finish a game.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import { addPlayer, deletePlayer } from '../src/features/players/playerRepo';
import { getSettings, saveGame, saveSettings, exportBackup, importBackup } from '../src/features/games/gameRepo';
import { addRound, createGame, finalizeGame, standingsOf } from '../src/features/games/gameOps';
import { computeSummary } from '../src/features/statistics/stats';
import { gameToCsv } from '../src/utils/export';
import type { RoundEntry } from '../src/types';

const e = (ids: string[], tricks: (number | 'p')[], booltIdx = -1): RoundEntry[] =>
  ids.map((playerId, i) => ({
    playerId,
    status: tricks[i] === 'p' ? 'passed' : 'played',
    tricks: tricks[i] === 'p' ? 0 : (tricks[i] as number),
    boolt: i === booltIdx,
    adjustment: 0,
  }));

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('create and finish a game (persisted)', () => {
  it('creates players, plays rounds, survives a reload, settles and feeds statistics', async () => {
    const names = ['Бат', 'Дорж', 'Сараа', 'Ганаа', 'Оюун'];
    const ps = [];
    for (const n of names) ps.push(await addPlayer({ name: n, avatar: '♠️', color: '#22c55e' }));
    await expect(addPlayer({ name: 'бат', avatar: '♠️', color: '#22c55e' })).rejects.toThrow();

    const settings = await getSettings();
    let g = createGame({ name: 'Integration', playedAt: '2026-11-22T12:00:00.000Z', players: ps, rules: settings.defaultRules, stake: settings.defaultStake, booltAmount: settings.defaultBooltAmount });
    await saveGame(g);
    const ids = ps.map((p) => p.id);

    // Player in an active game cannot be deleted.
    await expect(deletePlayer(ids[0])).rejects.toThrow();

    const rounds: [(number | 'p')[], number][] = [
      [[2, 1, 1, 1, 0], -1],
      [[3, 0, 1, 1, 'p'], 1],
      [[3, 1, 0, 1, 'p'], -1],
      [[4, 0, 1, 0, 'p'], -1],
      [[3, 1, 1, 'p', 'p'], -1],
    ];
    for (const [t, b] of rounds) {
      g = addRound(g, { entries: e(ids, t, b), instantWinPlayerId: null, note: '' });
      await saveGame(g);
    }

    // "Reload": read back from IndexedDB.
    const reloaded = (await db.games.get(g.id))!;
    expect(reloaded.rounds).toHaveLength(5);
    expect(standingsOf(reloaded).finished).toBe(true);

    // Changing default rules later must not affect this game.
    await saveSettings({ ...settings, defaultRules: { ...settings.defaultRules, booltMultiplier: 5, startingPoints: 30 } });

    const done = finalizeGame(reloaded);
    await saveGame(done);
    const stored = (await db.games.get(g.id))!;
    expect(stored.rules.booltMultiplier).toBe(2);
    expect(stored.status).toBe('finished');
    const net = Object.fromEntries(stored.settlement!.players.map((p) => [p.playerId, p.net]));
    expect(net[ids[0]]).toBe(25000);
    expect(net[ids[1]]).toBe(-10000);
    expect(Object.values(net).reduce((a, b) => a + b, 0)).toBe(0);

    // Single-device games never queue a Supabase sync.
    expect(await db.outbox.count()).toBe(0);

    const summary = computeSummary(await db.games.toArray());
    expect(summary.totalGames).toBe(1);
    expect(summary.biggestWinner!.name).toBe('Бат');
    expect(summary.biggestLoser!.name).toBe('Дорж');

    expect(gameToCsv(stored)).toContain('Төлөх хүн,Авах хүн,Дүн');

    // Players can be deleted after the game; history keeps names.
    await deletePlayer(ids[4]);
    expect((await db.games.get(g.id))!.players[4].name).toBe('Оюун');

    // Backup round-trip.
    const backup = await exportBackup();
    await db.games.clear();
    await importBackup(backup);
    expect(await db.games.count()).toBe(1);
  });

  it('queues exactly one outbox item for repeated saves of a shared game', async () => {
    const ps = [];
    for (const n of ['A', 'B', 'C', 'D', 'E']) ps.push(await addPlayer({ name: n, avatar: '♠️', color: '#22c55e' }));
    let g = createGame({ name: '', playedAt: '2026-11-22T12:00:00.000Z', players: ps, rules: (await getSettings()).defaultRules, stake: 1000, booltAmount: 1000 });
    g = { ...g, shared: { code: 'ABC234', remoteId: g.id, role: 'host' } };
    await saveGame(g);
    await saveGame({ ...g, version: g.version + 1 });
    expect(await db.outbox.count()).toBe(1);
  });
});
