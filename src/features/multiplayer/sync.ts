/**
 * Supabase synchronization for shared games.
 *
 * Model: the host device is the only writer. Every local change bumps
 * `game.version` and queues an outbox item. The outbox is flushed to the
 * `sync_game` RPC, which atomically replaces the game's rows and rejects any
 * payload whose version is not newer than the stored one (so a delayed retry
 * can never overwrite newer data). Viewers read via RLS-protected selects and
 * get notified through Supabase Realtime.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { db } from '../../lib/db';
import { ensureSession, isSupabaseConfigured, requireSupabase } from '../../lib/supabase';
import type { Game } from '../../types';
import { joinCode } from '../../utils/id';
import { fromRemote, toSyncPayload, type RemoteGameRow } from './mapping';

const SELECT = `id, join_code, name, played_at, status, stake, boolt_amount, version, created_at, updated_at, finished_at,
  game_rules(rules),
  game_players(player_id, seat, name, avatar, color),
  rounds(id, number, instant_win_player_id, note, created_at, updated_at, round_results(player_id, status, tricks, boolt, adjustment)),
  settlements(winner_ids, loser_ids, early, computed_at, players),
  settlement_payments(from_player, to_player, amount)`;

interface SyncResult {
  status: 'ok' | 'stale';
  version: number;
}

async function pushGame(game: Game): Promise<SyncResult> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('sync_game', { p: toSyncPayload(game) });
  if (error) throw new Error(error.message);
  return data as SyncResult;
}

/** Turns a local single-device game into a shared one and uploads it. */
export async function shareGame(game: Game): Promise<Game> {
  await ensureSession();
  if (game.shared) return game;
  let lastError: unknown;
  // Retry on the (unlikely) event of a join code collision.
  for (let i = 0; i < 4; i++) {
    const shared: Game = { ...game, shared: { code: joinCode(), remoteId: game.id, role: 'host' }, version: game.version + 1, updatedAt: new Date().toISOString() };
    try {
      await pushGame(shared);
      await db.games.put(shared);
      return shared;
    } catch (e) {
      lastError = e;
      if (!String((e as Error).message).includes('join_code')) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Хуваалцаж чадсангүй.');
}

export interface FlushReport {
  sent: number;
  failed: number;
  pending: number;
  error?: string;
}

let flushing: Promise<FlushReport> | null = null;

/** Sends all queued shared-game changes. Safe to call often; concurrent calls share one run. */
export function flushOutbox(): Promise<FlushReport> {
  if (!isSupabaseConfigured) return Promise.resolve({ sent: 0, failed: 0, pending: 0 });
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    let failed = 0;
    let error: string | undefined;
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return { sent, failed, pending: await db.outbox.count(), error: 'Офлайн' };
      }
      await ensureSession();
      const items = await db.outbox.orderBy('createdAt').toArray();
      for (const item of items) {
        const game = await db.games.get(item.entityId);
        if (!game || game.shared?.role !== 'host') {
          await db.outbox.delete(item.id);
          continue;
        }
        try {
          let res = await pushGame(game);
          if (res.status === 'stale') {
            // The server has a newer-or-equal version (e.g. restored backup on this device).
            // The host device is authoritative, so jump past the server version and resend.
            const bumped = { ...game, version: res.version + 1 };
            await db.games.put(bumped);
            res = await pushGame(bumped);
          }
          // Only clear the item if the game did not change while we were sending.
          const latest = await db.games.get(item.entityId);
          if (latest && latest.version <= Math.max(game.version, res.version)) await db.outbox.delete(item.id);
          sent++;
        } catch (e) {
          failed++;
          error = (e as Error).message;
          await db.outbox.update(item.id, { attempts: item.attempts + 1, lastError: error });
        }
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      flushing = null;
    }
    return { sent, failed, pending: await db.outbox.count(), error };
  })();
  return flushing;
}

export async function fetchRemoteGame(remoteId: string): Promise<RemoteGameRow> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('games').select(SELECT).eq('id', remoteId).single();
  if (error) throw new Error(error.message);
  return data as unknown as RemoteGameRow;
}

export const viewerLocalId = (remoteId: string) => `v-${remoteId}`;

/** Joins a shared game by code, stores a read-only copy locally and returns it. */
export async function joinByCode(code: string): Promise<Game> {
  const sb = requireSupabase();
  await ensureSession();
  const clean = code.trim().toUpperCase();
  const { data, error } = await sb.rpc('join_game', { p_code: clean });
  if (error) throw new Error(error.message.includes('not found') ? 'Ийм кодтой тоглолт олдсонгүй.' : error.message);
  const remoteId = data as string;
  // If we are the host of this game on this device, open our own copy.
  const own = await db.games.get(remoteId);
  if (own?.shared?.role === 'host') return own;
  return refreshViewerCopy(remoteId);
}

export async function refreshViewerCopy(remoteId: string): Promise<Game> {
  const row = await fetchRemoteGame(remoteId);
  const game = fromRemote(row, viewerLocalId(remoteId), 'viewer');
  const existing = await db.games.get(game.id);
  if (!existing || existing.version <= game.version) await db.games.put(game);
  return game;
}

/**
 * Subscribes to live changes of a shared game. Calls `onChange` whenever the
 * host syncs, and again after every (re)connect so missed events are recovered.
 */
export function subscribeToGame(remoteId: string, onChange: () => void, onStatus?: (s: string) => void): () => void {
  const sb = requireSupabase();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, 250);
  };
  const channel: RealtimeChannel = sb
    .channel(`game:${remoteId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${remoteId}` }, debounced)
    .subscribe((status) => {
      onStatus?.(status);
      if (status === 'SUBSCRIBED') debounced();
    });
  const onOnline = () => debounced();
  const onVisible = () => document.visibilityState === 'visible' && debounced();
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearTimeout(timer);
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    void sb.removeChannel(channel);
  };
}
