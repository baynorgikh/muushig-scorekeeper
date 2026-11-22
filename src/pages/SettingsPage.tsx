import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Database, Download, RotateCcw, Upload, XCircle } from 'lucide-react';
import { Button, Confirm, PageHeader } from '../components/ui';
import { useSettings } from '../hooks/useData';
import { RulesEditor } from '../features/scoring/RulesEditor';
import { DEFAULT_RULES, suggestedBooltAmount } from '../features/scoring/rules';
import { defaultSettings, exportBackup, importBackup, saveSettings, type BackupFile } from '../features/games/gameRepo';
import { isSupabaseConfigured } from '../lib/supabase';
import { useUi } from '../stores/uiStore';
import type { AppSettings } from '../types';
import { download } from '../utils/export';
import { db } from '../lib/db';
import { formatDateTime } from '../utils/format';

export default function SettingsPage() {
  const stored = useSettings();
  const toast = useUi((s) => s.toast);
  const { pendingSync, syncError, lastSyncedAt, online } = useUi();
  const [s, setS] = useState<AppSettings | null>(null);
  const [wipe, setWipe] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stored && !s) setS(stored);
  }, [stored, s]);

  if (!s) return <div className="py-20 text-center text-ink-400">Ачаалж байна…</div>;

  const save = async () => {
    await saveSettings(s);
    toast('Тохиргоо хадгалагдлаа. Шинэ тоглолтуудад хэрэглэгдэнэ.');
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Тохиргоо" subtitle="Шинэ тоглолтын анхдагч утгууд ба өгөгдөл" />

      <section className="card p-4 md:p-5">
        <h2 className="mb-1 font-semibold">Анхдагч бооцоо</h2>
        <p className="mb-4 text-sm text-ink-400">Шинэ тоглолт үүсгэхэд автоматаар бөглөгдөнө.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Гарааны бооцоо (₮)</span>
            <input type="number" min={0} step={500} className="num w-full" value={s.defaultStake} onChange={(e) => setS({ ...s, defaultStake: Math.max(0, Number(e.target.value) || 0) })} />
          </label>
          <label className="block">
            <span className="label">Боолтын дүн (₮)</span>
            <div className="flex gap-2">
              <input type="number" min={0} step={500} className="num w-full" value={s.defaultBooltAmount} onChange={(e) => setS({ ...s, defaultBooltAmount: Math.max(0, Number(e.target.value) || 0) })} />
              <Button variant="subtle" size="sm" onClick={() => setS({ ...s, defaultBooltAmount: suggestedBooltAmount(s.defaultStake, s.defaultRules.booltMultiplier) })}>
                ×{s.defaultRules.booltMultiplier}
              </Button>
            </div>
          </label>
        </div>
      </section>

      <section className="card p-4 md:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Анхдагч дүрэм</h2>
            <p className="text-sm text-ink-400">Өмнөх тоглолтууд өөрийн дүрмийн хуулбарыг хадгалдаг тул энд өөрчилсөн ч түүх өөрчлөгдөхгүй.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setS({ ...s, defaultRules: { ...DEFAULT_RULES } })}>
            <RotateCcw size={16} /> Анхны
          </Button>
        </div>
        <RulesEditor rules={s.defaultRules} onChange={(r) => setS({ ...s, defaultRules: r })} />
      </section>

      <div className="sticky bottom-20 z-10 md:bottom-4">
        <Button size="lg" className="w-full" onClick={save}>
          Хадгалах
        </Button>
      </div>

      <section className="card p-4 md:p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Database size={18} className="text-gold-400" /> Олон утсаар хуваалцах (Supabase)
        </h2>
        {isSupabaseConfigured ? (
          <div className="space-y-1 text-sm">
            <p className="flex items-center gap-2 text-felt-400">
              <CheckCircle2 size={16} /> Supabase холбогдсон
            </p>
            <p className="text-ink-400">Сүлжээ: {online ? 'онлайн' : 'офлайн'} · Илгээгдээгүй өөрчлөлт: {pendingSync}</p>
            {lastSyncedAt && <p className="text-ink-400">Сүүлд илгээсэн: {formatDateTime(lastSyncedAt)}</p>}
            {syncError && <p className="text-ruby-400">Сүүлийн алдаа: {syncError}</p>}
          </div>
        ) : (
          <div className="space-y-2 text-sm text-ink-300">
            <p className="flex items-center gap-2 text-ruby-400">
              <XCircle size={16} /> Supabase тохируулаагүй — нэг төхөөрөмжийн горим бүрэн ажиллана.
            </p>
            <p>Хуваалцах горимыг идэвхжүүлэхийн тулд:</p>
            <ol className="list-decimal space-y-1 pl-5 text-ink-400">
              <li>supabase.com дээр төсөл үүсгэнэ.</li>
              <li>
                <code>supabase/migrations</code> доторх SQL-ийг ажиллуулна.
              </li>
              <li>Authentication → Anonymous sign-ins-ийг идэвхжүүлнэ.</li>
              <li>
                Vercel (эсвэл <code>.env</code>) дээр <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code> оруулаад дахин build хийнэ.
              </li>
            </ol>
          </div>
        )}
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="mb-3 font-semibold">Өгөгдөл</h2>
        <p className="mb-4 text-sm text-ink-400">Бүх өгөгдөл энэ төхөөрөмжийн IndexedDB-д хадгалагдана. Төхөөрөмж солихдоо нөөц файл ашиглана уу.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={async () => download(`muushig_noots_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await exportBackup(), null, 2), 'application/json')}>
            <Download size={16} /> Нөөц татах
          </Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Нөөц сэргээх
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const r = await importBackup(JSON.parse(await f.text()) as BackupFile);
                setS(null);
                toast(`Сэргээлээ: ${r.players} тоглогч, ${r.games} тоглолт`);
              } catch (err) {
                toast((err as Error).message, 'error');
              }
            }}
          />
          <Button variant="ghost" className="text-ruby-400" onClick={() => setWipe(true)}>
            Бүх өгөгдөл устгах
          </Button>
        </div>
      </section>

      <Confirm
        open={wipe}
        danger
        title="Бүх өгөгдөл устгах уу?"
        confirmLabel="Бүгдийг устгах"
        text="Энэ төхөөрөмж дээрх бүх тоглогч, тоглолт, тохиргоо бүрмөсөн устна. Эхлээд нөөц татахыг зөвлөж байна."
        onClose={() => setWipe(false)}
        onConfirm={async () => {
          await db.transaction('rw', db.players, db.games, db.settings, db.outbox, async () => {
            await Promise.all([db.players.clear(), db.games.clear(), db.settings.clear(), db.outbox.clear()]);
          });
          localStorage.removeItem('muushig-round-drafts');
          setS(defaultSettings());
          toast('Бүх өгөгдөл устгагдлаа');
        }}
      />
    </div>
  );
}
