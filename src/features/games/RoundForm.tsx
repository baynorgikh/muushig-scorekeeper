import type { Game, RoundEntry } from '../../types';
import type { Standings } from '../scoring/engine';
import { entryDelta, validateRound } from '../scoring/engine';
import { Avatar, Button, Stepper } from '../../components/ui';
import { formatPoints } from '../../utils/format';
import type { RoundDraftState } from '../../stores/uiStore';
import { Zap } from 'lucide-react';

export function RoundForm({
  game,
  before,
  draft,
  onChange,
  onSubmit,
  submitLabel,
  busy,
}: {
  game: Game;
  before: Standings;
  draft: RoundDraftState;
  onChange: (d: RoundDraftState) => void;
  onSubmit: () => void;
  submitLabel: string;
  busy?: boolean;
}) {
  const r = game.rules;
  const ids = game.players.map((p) => p.playerId);
  const setEntry = (playerId: string, patch: Partial<RoundEntry>) =>
    onChange({ ...draft, entries: draft.entries.map((e) => (e.playerId === playerId ? { ...e, ...patch } : e)) });

  const validation = validateRound(draft, r, ids, before);
  const trickSum = draft.entries.filter((e) => e.status === 'played').reduce((s, e) => s + e.tricks, 0);
  const anyBoolt = draft.entries.some((e) => e.boolt);

  return (
    <div className="space-y-3">
      {game.players.map((gp) => {
        const e = draft.entries.find((x) => x.playerId === gp.playerId)!;
        const out = e.status === 'out';
        const delta = entryDelta(e, r);
        const total = before.totals[gp.playerId] + delta;
        return (
          <div key={gp.playerId} className={`rounded-xl border p-3 transition ${e.boolt ? 'border-gold-500/70 bg-gold-900/30' : 'border-ink-700 bg-ink-800/60'} ${out ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3">
              <Avatar avatar={gp.avatar} color={gp.color} name={gp.name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{gp.name}</div>
                <div className="num text-xs text-ink-400">
                  {before.totals[gp.playerId]} → <b className="text-ink-100">{total}</b>
                </div>
              </div>
              <div className={`num w-14 text-right text-xl font-bold ${delta < 0 ? 'text-felt-400' : delta > 0 ? 'text-ruby-400' : 'text-ink-400'}`}>{out ? '—' : formatPoints(delta)}</div>
            </div>

            {out ? (
              <div className="mt-2 text-xs text-ink-400">Гарсан</div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl border border-ink-600 p-0.5">
                  {(['played', 'passed'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEntry(gp.playerId, st === 'passed' ? { status: st, tricks: 0, boolt: false } : { status: st })}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${e.status === st ? 'bg-ink-600 text-white' : 'text-ink-400'}`}
                      aria-pressed={e.status === st}
                    >
                      {st === 'played' ? 'Тоглосон' : 'Сугарсан'}
                    </button>
                  ))}
                </div>
                {e.status === 'played' && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-ink-400">Мөр</span>
                      <Stepper value={e.tricks} onChange={(v) => setEntry(gp.playerId, { tricks: v })} max={r.tricksPerRound} label={`${gp.name} мөр`} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setEntry(gp.playerId, { boolt: !e.boolt })}
                      className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold transition ${e.boolt ? 'bg-gold-500 text-ink-950' : 'border border-ink-600 text-ink-300 hover:border-gold-500'}`}
                      aria-pressed={e.boolt}
                    >
                      <Zap size={15} /> Боолт ×{r.booltMultiplier}
                    </button>
                  </>
                )}
                {r.allowManualAdjust && (
                  <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-400">
                    Засвар
                    <input
                      type="number"
                      inputMode="numeric"
                      className="num w-20 px-2 py-1.5 text-sm"
                      value={e.adjustment || ''}
                      placeholder="0"
                      onChange={(ev) => setEntry(gp.playerId, { adjustment: Number(ev.target.value) || 0 })}
                      aria-label={`${gp.name} гар засвар`}
                    />
                  </label>
                )}
              </div>
            )}
          </div>
        );
      })}

      {r.fourSuitInstantWin && (
        <div>
          <label className="label" htmlFor="instant">
            Дөрвөн тамга (шууд хожил)
          </label>
          <select id="instant" className="w-full" value={draft.instantWinPlayerId ?? ''} onChange={(e) => onChange({ ...draft, instantWinPlayerId: e.target.value || null })}>
            <option value="">— Байхгүй —</option>
            {game.players
              .filter((p) => before.outAtRound[p.playerId] === undefined)
              .map((p) => (
                <option key={p.playerId} value={p.playerId}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      )}

      <div>
        <label className="label" htmlFor="note">
          Тэмдэглэл (заавал биш)
        </label>
        <input id="note" className="w-full" maxLength={500} value={draft.note} onChange={(e) => onChange({ ...draft, note: e.target.value })} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className={`num ${!r.enforceTrickTotal || trickSum === r.tricksPerRound || draft.instantWinPlayerId ? 'text-ink-400' : 'text-ruby-400'}`}>
          Мөрийн нийлбэр: {trickSum}/{r.tricksPerRound}
        </span>
        {anyBoolt && (
          <span className="rounded-full bg-gold-900 px-2.5 py-0.5 font-semibold text-gold-400">
            Боолт ×{r.booltMultiplier} {r.booltAffectsPoints ? 'оноонд' : ''}
            {r.booltAffectsPoints && r.booltAffectsMoney && r.settlementMode === 'stake' ? ' ба ' : ''}
            {r.booltAffectsMoney && r.settlementMode === 'stake' ? 'мөнгөнд' : ''} нөлөөлнө
          </span>
        )}
      </div>

      {!validation.ok && (
        <ul className="space-y-1 rounded-xl bg-ruby-900/50 p-3 text-sm text-ruby-400">
          {validation.errors.map((err) => (
            <li key={err}>• {err}</li>
          ))}
        </ul>
      )}

      <Button variant="primary" size="lg" className="w-full" disabled={!validation.ok || busy} onClick={onSubmit}>
        {submitLabel}
      </Button>
    </div>
  );
}
