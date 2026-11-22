import { db } from '../../lib/db';
import type { AppSettings, Game } from '../../types';
import { DEFAULT_RULES, DEFAULT_STAKE, suggestedBooltAmount } from '../scoring/rules';
import { uid } from '../../utils/id';

/** Saves a game locally and, for shared games we host, queues a sync to Supabase. */
export async function saveGame(game: Game): Promise<void> {
  await db.transaction('rw', db.games, db.outbox, async () => {
    await db.games.put(game);
    if (game.shared?.role === 'host') {
      // One pending item per game is enough — the latest local state is always sent.
      const pending = await db.outbox.where('entityId').equals(game.id).first();
      if (!pending) {
        await db.outbox.add({ id: uid(), kind: 'upsert_game', entityId: game.id, createdAt: new Date().toISOString(), attempts: 0 });
      }
    }
  });
  window.dispatchEvent(new Event('muushig:outbox'));
}

export async function deleteGame(id: string): Promise<void> {
  await db.transaction('rw', db.games, db.outbox, async () => {
    await db.games.delete(id);
    await db.outbox.where('entityId').equals(id).delete();
  });
}

export const defaultSettings = (): AppSettings => ({
  id: 'app',
  defaultRules: { ...DEFAULT_RULES },
  defaultStake: DEFAULT_STAKE,
  defaultBooltAmount: suggestedBooltAmount(DEFAULT_STAKE, DEFAULT_RULES.booltMultiplier),
});

export async function getSettings(): Promise<AppSettings> {
  const s = await db.settings.get('app');
  if (!s) return defaultSettings();
  // Merge so newly added rule keys get defaults.
  return { ...defaultSettings(), ...s, defaultRules: { ...DEFAULT_RULES, ...s.defaultRules } };
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await db.settings.put(s);
}

export interface BackupFile {
  app: 'muushig-scorekeeper';
  version: 1;
  exportedAt: string;
  players: unknown[];
  games: unknown[];
  settings: unknown;
}

export async function exportBackup(): Promise<BackupFile> {
  return {
    app: 'muushig-scorekeeper',
    version: 1,
    exportedAt: new Date().toISOString(),
    players: await db.players.toArray(),
    games: await db.games.toArray(),
    settings: await db.settings.get('app'),
  };
}

export async function importBackup(data: BackupFile): Promise<{ players: number; games: number }> {
  if (data?.app !== 'muushig-scorekeeper' || !Array.isArray(data.players) || !Array.isArray(data.games)) {
    throw new Error('Нөөц файлын формат буруу байна.');
  }
  await db.transaction('rw', db.players, db.games, db.settings, async () => {
    await db.players.bulkPut(data.players as never[]);
    await db.games.bulkPut(data.games as never[]);
    if (data.settings) await db.settings.put(data.settings as AppSettings);
  });
  return { players: data.players.length, games: data.games.length };
}
