import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, ChevronDown, Plus, Search, Smartphone, Users2, X } from 'lucide-react';
import { Avatar, Button, Modal, PageHeader, Segmented } from '../components/ui';
import { usePlayers, useSettings } from '../hooks/useData';
import { PlayerForm } from '../features/players/PlayerForm';
import { addPlayer } from '../features/players/playerRepo';
import { RulesEditor } from '../features/scoring/RulesEditor';
import { suggestedBooltAmount } from '../features/scoring/rules';
import { createGame, GameError } from '../features/games/gameOps';
import { saveGame } from '../features/games/gameRepo';
import { shareGame } from '../features/multiplayer/sync';
import { isSupabaseConfigured } from '../lib/supabase';
import { useUi } from '../stores/uiStore';
import { PLAYERS_PER_GAME, type GameRules } from '../types';
import { formatMoney, toLocalInput } from '../utils/format';

const schema = z.object({
  name: z.string().max(80, 'Нэр хэт урт байна'),
  stake: z.number({ message: 'Дүн оруулна уу' }).int('Бүхэл тоо оруулна уу').min(0, 'Сөрөг байж болохгүй').max(100_000_000),
  booltAmount: z.number({ message: 'Дүн оруулна уу' }).int('Бүхэл тоо оруулна уу').min(0, 'Сөрөг байж болохгүй').max(100_000_000),
  playedAt: z.string().min(1, 'Огноо оруулна уу'),
});
type FormValues = z.infer<typeof schema>;

export default function NewGamePage() {
  const navigate = useNavigate();
  const players = usePlayers();
  const settings = useSettings();
  const toast = useUi((s) => s.toast);
  const [selected, setSelected] = useState<string[]>([]);
  const [rules, setRules] = useState<GameRules | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [mode, setMode] = useState<'single' | 'shared'>('single');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [selError, setSelError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '', stake: 5000, booltAmount: 5000, playedAt: toLocalInput(new Date().toISOString()) } });

  useEffect(() => {
    if (settings && !rules) {
      setRules({ ...settings.defaultRules });
      reset({ name: '', stake: settings.defaultStake, booltAmount: settings.defaultBooltAmount, playedAt: toLocalInput(new Date().toISOString()) });
    }
  }, [settings, rules, reset]);

  const stake = watch('stake');
  const booltAmount = watch('booltAmount');
  const filtered = useMemo(() => (players ?? []).filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())), [players, q]);

  const toggle = (id: string) => {
    setSelError(null);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= PLAYERS_PER_GAME ? s : [...s, id]));
  };

  const onSubmit = handleSubmit(async (v) => {
    if (!rules || !players) return;
    if (selected.length !== PLAYERS_PER_GAME) {
      setSelError(`Муушиг яг ${PLAYERS_PER_GAME} тоглогчтой тоглогдоно. Одоо ${selected.length} сонгосон байна.`);
      return;
    }
    try {
      let game = createGame({
        name: v.name,
        playedAt: new Date(v.playedAt).toISOString(),
        players: selected.map((id) => players.find((p) => p.id === id)!),
        rules,
        stake: v.stake,
        booltAmount: v.booltAmount,
      });
      await saveGame(game);
      if (mode === 'shared') {
        try {
          game = await shareGame(game);
          toast(`Хуваалцах код: ${game.shared?.code}`);
        } catch (e) {
          toast(`Хуваалцаж чадсангүй: ${(e as Error).message}. Тоглолт энэ төхөөрөмж дээр үргэлжилнэ.`, 'error');
        }
      }
      navigate(`/game/${game.id}`);
    } catch (e) {
      toast(e instanceof GameError ? e.errors.join(' ') : (e as Error).message, 'error');
    }
  });

  if (!rules) return <div className="py-20 text-center text-ink-400">Ачаалж байна…</div>;

  return (
    <>
    <form onSubmit={onSubmit} className="space-y-5 pb-4">
      <PageHeader title="Шинэ тоглолт" subtitle="Яг 5 тоглогч сонгож, бооцоо болон дүрмээ тохируулна уу" />

      <section className="card p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <Users2 size={18} className="text-gold-400" /> Тоглогчид
          </h2>
          <span className={`num rounded-full px-2.5 py-0.5 text-sm font-bold ${selected.length === PLAYERS_PER_GAME ? 'bg-felt-500/20 text-felt-400' : 'bg-ink-700 text-ink-300'}`}>
            {selected.length}/{PLAYERS_PER_GAME}
          </span>
        </div>

        <div className="mb-3 flex min-h-12 flex-wrap gap-2">
          {selected.map((id, i) => {
            const p = players?.find((x) => x.id === id);
            if (!p) return null;
            return (
              <button key={id} type="button" onClick={() => toggle(id)} className="animate-pop flex items-center gap-2 rounded-full bg-ink-800 py-1 pl-1 pr-3 text-sm ring-1 ring-ink-600 hover:ring-ruby-500" aria-label={`${p.name}-г хасах`}>
                <Avatar avatar={p.avatar} color={p.color} name={p.name} size={28} />
                <span className="text-ink-400">{i + 1}.</span> {p.name}
                <X size={14} className="text-ink-400" />
              </button>
            );
          })}
          {selected.length === 0 && <span className="self-center text-sm text-ink-400">Доороос 5 тоглогч сонгоно уу (суудлын дарааллаар).</span>}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Хайх…" className="w-full pl-9" aria-label="Тоглогч хайх" />
          </div>
          <Button variant="subtle" onClick={() => setAdding(true)}>
            <Plus size={18} /> Шинэ
          </Button>
        </div>

        <div className="mt-3 grid max-h-72 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {filtered.map((p) => {
            const on = selected.includes(p.id);
            const full = !on && selected.length >= PLAYERS_PER_GAME;
            return (
              <button
                key={p.id}
                type="button"
                disabled={full}
                onClick={() => toggle(p.id)}
                className={`flex items-center gap-2 rounded-xl p-2 text-left transition ${on ? 'bg-felt-500/15 ring-2 ring-felt-500' : 'bg-ink-800 hover:bg-ink-700'} disabled:opacity-40`}
                aria-pressed={on}
              >
                <Avatar avatar={p.avatar} color={p.color} name={p.name} size={32} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                {on && <Check size={16} className="text-felt-400" />}
              </button>
            );
          })}
          {players?.length === 0 && <p className="col-span-full text-sm text-ink-400">Бүртгэлтэй тоглогч алга. “Шинэ” товчоор нэмнэ үү.</p>}
        </div>
        {selError && <p className="mt-3 text-sm text-ruby-400">{selError}</p>}
      </section>

      <section className="card grid gap-4 p-4 sm:grid-cols-2 md:p-5">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="gname">
            Тоглолтын нэр (заавал биш)
          </label>
          <input id="gname" className="w-full" placeholder="Жишээ: Баасан гарагийн муушиг" {...register('name')} />
          {errors.name && <p className="mt-1 text-sm text-ruby-400">{errors.name.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="stake">
            Гарааны бооцоо (₮)
          </label>
          <input id="stake" type="number" inputMode="numeric" step={500} className="num w-full text-lg" {...register('stake', { valueAsNumber: true })} />
          {errors.stake && <p className="mt-1 text-sm text-ruby-400">{errors.stake.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="boolt">
            Боолтын дүн (₮)
          </label>
          <div className="flex gap-2">
            <input id="boolt" type="number" inputMode="numeric" step={500} className="num w-full text-lg" {...register('booltAmount', { valueAsNumber: true })} />
            <Button variant="subtle" size="sm" onClick={() => setValue('booltAmount', suggestedBooltAmount(Number(stake) || 0, rules.booltMultiplier), { shouldValidate: true })} title="Үржвэрээр тооцох">
              ×{rules.booltMultiplier}
            </Button>
          </div>
          {errors.booltAmount && <p className="mt-1 text-sm text-ruby-400">{errors.booltAmount.message}</p>}
          <p className="mt-1 text-xs text-ink-400">
            Боолт хийгээд хожигдсон тоглогч: {formatMoney(Number(stake) || 0)} + {formatMoney(Number(booltAmount) || 0)} = {formatMoney((Number(stake) || 0) + (Number(booltAmount) || 0))}
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="playedAt">
            Огноо, цаг
          </label>
          <input id="playedAt" type="datetime-local" className="w-full" {...register('playedAt')} />
          {errors.playedAt && <p className="mt-1 text-sm text-ruby-400">{errors.playedAt.message}</p>}
        </div>
      </section>

      <section className="card p-4 md:p-5">
        <button type="button" onClick={() => setShowRules((s) => !s)} className="flex w-full items-center justify-between font-semibold" aria-expanded={showRules}>
          <span>Тоглоомын дүрэм</span>
          <span className="flex items-center gap-2 text-sm font-normal text-ink-400">
            {rules.startingPoints} оноо · боолт ×{rules.booltMultiplier} {rules.fourSuitInstantWin ? '· дөрвөн тамга' : ''}
            <ChevronDown size={18} className={`transition ${showRules ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {showRules && (
          <div className="mt-4">
            <p className="mb-4 rounded-xl bg-gold-900/60 p-3 text-xs text-gold-400">Энэ тохиргоо зөвхөн энэ тоглолтод хадгалагдана. Дараа нь “Тохиргоо” хэсэгт дүрэм өөрчилсөн ч энэ тоглолтын үр дүн өөрчлөгдөхгүй.</p>
            <RulesEditor rules={rules} onChange={setRules} />
          </div>
        )}
      </section>

      <section className="card p-4 md:p-5">
        <div className="label">Горим</div>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'single', label: 'Нэг төхөөрөмж' },
            { value: 'shared', label: 'Олон утсаар хуваалцах' },
          ]}
        />
        {mode === 'shared' && !isSupabaseConfigured && (
          <p className="mt-3 rounded-xl bg-ruby-900/60 p-3 text-sm text-ruby-400">
            Хуваалцах горим ажиллахын тулд Supabase тохируулах шаардлагатай (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). Одоогоор нэг төхөөрөмжийн горимоор үргэлжилнэ.
          </p>
        )}
        {mode === 'shared' && isSupabaseConfigured && (
          <p className="mt-3 flex items-start gap-2 text-sm text-ink-400">
            <Smartphone size={16} className="mt-0.5 shrink-0" /> Та хөтлөгч болно. Бусад тоглогчид код эсвэл QR-ээр нэгдэж, оноог шууд харна.
          </p>
        )}
      </section>

      <div className="sticky bottom-20 z-10 md:bottom-4">
        <Button type="submit" size="lg" variant="gold" className="w-full" disabled={isSubmitting}>
          Тоглолт эхлүүлэх ({selected.length}/{PLAYERS_PER_GAME})
        </Button>
      </div>
    </form>

      <Modal open={adding} onClose={() => setAdding(false)} title="Шинэ тоглогч">
        <PlayerForm
          submitLabel="Нэмэх"
          onCancel={() => setAdding(false)}
          onSubmit={async (v) => {
            const p = await addPlayer(v);
            if (selected.length < PLAYERS_PER_GAME) setSelected((s) => [...s, p.id]);
            setAdding(false);
          }}
        />
      </Modal>
    </>
  );
}
