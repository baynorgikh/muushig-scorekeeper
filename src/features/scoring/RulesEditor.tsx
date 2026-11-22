import type { GameRules } from '../../types';
import { Segmented, Toggle } from '../../components/ui';
import { RULE_DESCRIPTIONS as D } from './rules';

function NumField({ k, rules, onChange, min = 0, max = 100, step = 1 }: { k: keyof GameRules; rules: GameRules; onChange: (r: GameRules) => void; min?: number; max?: number; step?: number }) {
  const id = `rule-${k}`;
  return (
    <div>
      <label className="label" htmlFor={id}>
        {D[k].label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        className="num w-full"
        value={rules[k] as number}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange({ ...rules, [k]: Math.min(max, Math.max(min, v)) });
        }}
      />
      <p className="mt-1 text-xs text-ink-400">{D[k].help}</p>
    </div>
  );
}

export function RulesEditor({ rules, onChange }: { rules: GameRules; onChange: (r: GameRules) => void }) {
  const set = <K extends keyof GameRules>(k: K, v: GameRules[K]) => onChange({ ...rules, [k]: v });
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumField k="startingPoints" rules={rules} onChange={onChange} min={1} max={200} />
        <NumField k="targetScore" rules={rules} onChange={onChange} min={-50} max={100} />
        <NumField k="pointsPerTrick" rules={rules} onChange={onChange} min={0} max={20} />
        <NumField k="noTrickPenalty" rules={rules} onChange={onChange} min={0} max={50} />
        <NumField k="passPenalty" rules={rules} onChange={onChange} min={0} max={50} />
        <NumField k="booltMultiplier" rules={rules} onChange={onChange} min={1} max={10} step={0.5} />
      </div>

      <div>
        <div className="label">{D.endCondition.label}</div>
        <Segmented
          value={rules.endCondition}
          onChange={(v) => set('endCondition', v)}
          options={[
            { value: 'first_out', label: 'Эхэлж гарсан нь хожно' },
            { value: 'last_remaining', label: 'Сүүлд үлдсэн нь хожигдоно' },
          ]}
        />
        <p className="mt-1 text-xs text-ink-400">
          {rules.endCondition === 'first_out'
            ? 'Хамгийн түрүүнд гарах оноонд хүрсэн тоглогч хожиж, тоглолт дуусна. Бусад нь хожигчид бооцоо төлнө.'
            : 'Гарах оноонд хүрсэн тоглогчид нэг нэгээрээ гарна. Ганцаараа үлдсэн тоглогч хожигдож, бусад бүрт бооцоо төлнө.'}
        </p>
      </div>

      <div>
        <div className="label">{D.settlementMode.label}</div>
        <Segmented
          value={rules.settlementMode}
          onChange={(v) => set('settlementMode', v)}
          options={[
            { value: 'stake', label: 'Гарааны бооцоогоор' },
            { value: 'points', label: 'Онооны зөрүүгээр' },
          ]}
        />
        {rules.settlementMode === 'points' && (
          <div className="mt-3 max-w-xs">
            <NumField k="pointValue" rules={rules} onChange={onChange} min={1} max={1_000_000} step={100} />
          </div>
        )}
      </div>

      <div className="divide-y divide-ink-700 rounded-xl border border-ink-700 px-4">
        <Toggle checked={rules.enforceTrickTotal} onChange={(v) => set('enforceTrickTotal', v)} label={D.enforceTrickTotal.label} help={D.enforceTrickTotal.help} />
        <Toggle checked={rules.booltAffectsPoints} onChange={(v) => set('booltAffectsPoints', v)} label={D.booltAffectsPoints.label} help={D.booltAffectsPoints.help} />
        <Toggle checked={rules.booltAffectsMoney} onChange={(v) => set('booltAffectsMoney', v)} label={D.booltAffectsMoney.label} help={D.booltAffectsMoney.help} disabled={rules.settlementMode === 'points'} />
        <Toggle checked={rules.fourSuitInstantWin} onChange={(v) => set('fourSuitInstantWin', v)} label={D.fourSuitInstantWin.label} help={D.fourSuitInstantWin.help} />
        <Toggle checked={rules.allowManualAdjust} onChange={(v) => set('allowManualAdjust', v)} label={D.allowManualAdjust.label} help={D.allowManualAdjust.help} />
      </div>
    </div>
  );
}
