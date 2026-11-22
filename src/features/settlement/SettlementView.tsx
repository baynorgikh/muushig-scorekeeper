import { ArrowRight, Crown } from 'lucide-react';
import type { Game, Settlement } from '../../types';
import { Avatar } from '../../components/ui';
import { formatMoney, formatSigned } from '../../utils/format';
import { isBalanced } from './settlement';

export function SettlementView({ game, settlement }: { game: Game; settlement: Settlement }) {
  const gp = (id: string) => game.players.find((p) => p.playerId === id)!;
  const totalPaid = settlement.payments.reduce((s, p) => s + p.amount, 0);
  const rows = [...settlement.players].sort((a, b) => b.net - a.net);
  return (
    <div className="space-y-4">
      {settlement.early && (
        <p className="rounded-xl bg-gold-900/60 p-3 text-sm text-gold-400">
          Тоглолт дуусах нөхцөлд хүрээгүй байна. {game.rules.endCondition === 'first_out' ? 'Хамгийн бага оноотой' : 'Хамгийн их оноотой'} тоглогчоор түр тооцоолов.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="py-2 font-medium">Тоглогч</th>
              <th className="py-2 text-right font-medium">Оноо</th>
              <th className="hidden py-2 text-right font-medium sm:table-cell">Боолт</th>
              <th className="hidden py-2 text-right font-medium sm:table-cell">Төлөх</th>
              <th className="hidden py-2 text-right font-medium sm:table-cell">Авах</th>
              <th className="py-2 text-right font-medium">Цэвэр</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700">
            {rows.map((p) => {
              const g = gp(p.playerId);
              return (
                <tr key={p.playerId}>
                  <td className="py-2.5">
                    <span className="flex items-center gap-2">
                      <Avatar avatar={g.avatar} color={g.color} name={g.name} size={28} />
                      <span className="font-medium">{g.name}</span>
                      {settlement.winnerIds.includes(p.playerId) && <Crown size={14} className="text-gold-400" aria-label="Хожсон" />}
                      {p.booltCount > 0 && <span className="rounded bg-gold-900 px-1.5 text-[11px] font-bold text-gold-400 sm:hidden">Б×{p.booltCount}</span>}
                    </span>
                  </td>
                  <td className="num py-2.5 text-right">{p.finalPoints}</td>
                  <td className="num hidden py-2.5 text-right sm:table-cell">{p.booltCount || ''}</td>
                  <td className="num hidden py-2.5 text-right text-ruby-400 sm:table-cell">{p.pays ? formatMoney(p.pays) : '—'}</td>
                  <td className="num hidden py-2.5 text-right text-felt-400 sm:table-cell">{p.receives ? formatMoney(p.receives) : '—'}</td>
                  <td className={`num py-2.5 text-right font-bold ${p.net > 0 ? 'text-felt-400' : p.net < 0 ? 'text-ruby-400' : ''}`}>{formatSigned(p.net)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="mb-2 font-semibold">Төлбөр ({settlement.payments.length})</h3>
        {settlement.payments.length === 0 ? (
          <p className="text-sm text-ink-400">Төлбөр шаардлагагүй.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="py-2 font-medium">Төлөх хүн</th>
                <th />
                <th className="py-2 font-medium">Авах хүн</th>
                <th className="py-2 text-right font-medium">Дүн</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {settlement.payments.map((p, i) => (
                <tr key={i}>
                  <td className="py-2.5 font-medium">{gp(p.from).name}</td>
                  <td className="text-ink-400">
                    <ArrowRight size={16} />
                  </td>
                  <td className="py-2.5 font-medium">{gp(p.to).name}</td>
                  <td className="num py-2.5 text-right font-bold text-gold-400">{formatMoney(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className={`mt-2 text-xs ${isBalanced(settlement) ? 'text-ink-400' : 'text-ruby-400'}`}>
          Нийт шилжүүлэг {formatMoney(totalPaid)} · {isBalanced(settlement) ? 'Тооцоо тэнцсэн (Σ = 0)' : 'Анхаар: тооцоо тэнцэхгүй байна'}
        </p>
      </div>
    </div>
  );
}
