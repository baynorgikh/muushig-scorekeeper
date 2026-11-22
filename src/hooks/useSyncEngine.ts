import { useEffect } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { flushOutbox } from '../features/multiplayer/sync';
import { useUi } from '../stores/uiStore';
import { db } from '../lib/db';

/** Background loop: tracks connectivity and flushes queued shared-game changes with backoff. */
export function useSyncEngine() {
  const setOnline = useUi((s) => s.setOnline);
  const setSync = useUi((s) => s.setSync);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if (!isSupabaseConfigured) {
      return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      };
    }

    let delay = 2000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const run = async () => {
      clearTimeout(timer);
      const pendingBefore = await db.outbox.count();
      if (pendingBefore === 0) {
        setSync({ pending: 0 });
        timer = setTimeout(run, 30000);
        return;
      }
      const r = await flushOutbox();
      if (stopped) return;
      setSync({ pending: r.pending, error: r.failed || (r.error && r.pending) ? r.error ?? null : null, syncedAt: r.sent ? new Date().toISOString() : undefined });
      delay = r.pending ? Math.min(delay * 2, 60000) : 2000;
      timer = setTimeout(run, r.pending ? delay : 30000);
    };
    const kick = () => {
      delay = 2000;
      void run();
    };
    window.addEventListener('online', kick);
    window.addEventListener('muushig:outbox', kick);
    void run();
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', kick);
      window.removeEventListener('muushig:outbox', kick);
    };
  }, [setOnline, setSync]);
}
