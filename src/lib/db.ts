import Dexie, { type EntityTable } from 'dexie';
import type { AppSettings, Game, OutboxItem, Player } from '../types';

/** IndexedDB database — the source of truth on each device. */
export class MuushigDB extends Dexie {
  players!: EntityTable<Player, 'id'>;
  games!: EntityTable<Game, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;
  outbox!: EntityTable<OutboxItem, 'id'>;

  constructor(name = 'muushig') {
    super(name);
    this.version(1).stores({
      players: 'id, name, createdAt',
      games: 'id, status, playedAt, updatedAt, shared.code',
      settings: 'id',
      outbox: 'id, entityId, createdAt',
    });
  }
}

export const db = new MuushigDB();
