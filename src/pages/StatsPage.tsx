import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Trophy } from 'lucide-react';
import { Avatar, Empty, PageHeader, Segmented, Stat } from '../components/ui';
import { useGames } from '../hooks/useData';
import { computeSummary, monthlyGameCount, profitOverTime, rangeFor, type RangeKey } from '../features/statistics/stats';
import { formatMoney, formatSigned, percent } from '../utils/format';

const axis = { stroke: '#7d8ba6', fontSize: 11 };
const tooltipStyle = { background: '#0f182a', border: '1px solid #2a3a58', borderRadius: 12, color: '#e7ebf3' };

export default function StatsPage() {
  const games = useGames();
  const [key, setKey] = useState<RangeKey>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const range = useMemo(() => rangeFor(key, new Date(), { from, to }), [key, from, to]);
  const summary = useMemo(() => computeSummary(games ?? [], range), [games, range]);
  const top = useMemo(() => summary.players.slice(0, 8), [summary]);
  const profit = useMemo(() => profitOverTime(games ?? [], range, top.map((p) => p.playerId)), [games, range, top]);
  const monthly = useMemo(() => monthlyGameCount(games ?? [], range), [games, range]);

  const totalNet = summary.players.reduce((s, p) => s + p.net, 0);
  const avgGame = summary.totalGames ? Math.round(summary.moneyMoved / summary.totalGames) : 0;
  const winRate = summary.totalWins + summary.totalLosses ? summary.totalWins / (summary.totalWins + summary.totalLosses) : 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Статистик" subtitle="Дууссан тоглолтуудын үзүүлэлт" />
      <div className="flex flex-wrap items-end gap-3">
        <Segmented
          value={key}
          onChange={setKey}
          options={[
            { value: 'today', label: 'Өнөөдөр' },
            { value: 'week', label: 'Энэ долоо хоног' },
            { value: 'month', label: 'Энэ сар' },
            { value: 'all', label: 'Бүх хугацаа' },
            { value: 'custom', label: 'Сонгох' },
          ]}
        />
        {key === 'custom' && (
          <div className="flex gap-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Эхлэх огноо" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Дуусах огноо" />
          </div>
        )}
      </div>

      {summary.totalGames === 0 ? (
        <Empty icon={<BarChart3 size={40} />} title="Энэ хугацаанд дууссан тоглолт алга" text="Тоглолт дуусгаж, тооцоог баталгаажуулсны дараа статистик харагдана." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Нийт тоглолт" value={summary.totalGames} />
            <Stat label="Нийт хожил" value={summary.totalWins} tone="good" />
            <Stat label="Нийт хожигдол" value={summary.totalLosses} tone="bad" />
            <Stat label="Хожлын хувь" value={percent(winRate)} hint="Хожил / (хожил + хожигдол)" />
            <Stat label="Цэвэр ашиг/алдагдал" value={formatSigned(totalNet)} hint="Нийлбэр үргэлж 0 байна" />
            <Stat label="Тоглолтын дундаж эргэлт" value={formatMoney(avgGame)} tone="gold" />
            <Stat label="Их хожигч" value={summary.biggestWinner ? formatSigned(summary.biggestWinner.net) : '—'} tone="good" hint={summary.biggestWinner?.name} />
            <Stat label="Их хожигдогч" value={summary.biggestLoser ? formatSigned(summary.biggestLoser.net) : '—'} tone="bad" hint={summary.biggestLoser?.name} />
          </div>

          <section className="card p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <Trophy size={18} className="text-gold-400" /> Тоглогчдын жагсаалт
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[340px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                    <th className="py-2 font-medium">#</th>
                    <th className="py-2 font-medium">Тоглогч</th>
                    <th className="hidden py-2 text-right font-medium sm:table-cell">Тоглолт</th>
                    <th className="py-2 text-right font-medium">Хожил</th>
                    <th className="py-2 text-right font-medium">Хувь</th>
                    <th className="hidden py-2 text-right font-medium sm:table-cell">Дундаж</th>
                    <th className="py-2 text-right font-medium">Нийт</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700">
                  {summary.players.map((p, i) => (
                    <tr key={p.playerId}>
                      <td className="py-2 text-ink-400">{i + 1}</td>
                      <td className="py-2">
                        <span className="flex items-center gap-2">
                          <Avatar avatar={p.avatar} color={p.color} name={p.name} size={26} /> {p.name}
                        </span>
                      </td>
                      <td className="num hidden py-2 text-right sm:table-cell">{p.games}</td>
                      <td className="num py-2 text-right">{p.wins}</td>
                      <td className="num py-2 text-right">{percent(p.winRate)}</td>
                      <td className="num hidden py-2 text-right sm:table-cell">{formatSigned(p.avgResult)}</td>
                      <td className={`num py-2 text-right font-bold ${p.net >= 0 ? 'text-felt-400' : 'text-ruby-400'}`}>{formatSigned(p.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card p-4">
            <h2 className="mb-3 font-semibold">Ашиг/алдагдал хугацаагаар (хуримтлагдсан)</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={profit} margin={{ left: 8, right: 8, top: 8 }}>
                  <CartesianGrid stroke="#1c2a44" vertical={false} />
                  <XAxis dataKey="date" {...axis} />
                  <YAxis {...axis} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={44} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatSigned(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {top.map((p) => (
                    <Line key={p.playerId} type="monotone" dataKey={p.playerId} name={p.name} stroke={p.color} strokeWidth={2} dot={profit.length < 2} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="card p-4">
              <h2 className="mb-3 font-semibold">Тоглогч бүрийн хожил</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.players} margin={{ left: 0, right: 8, top: 8 }}>
                    <CartesianGrid stroke="#1c2a44" vertical={false} />
                    <XAxis dataKey="name" {...axis} interval={0} />
                    <YAxis {...axis} allowDecimals={false} width={30} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#1c2a44' }} />
                    <Bar dataKey="wins" name="Хожил" fill="#17a85a" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="losses" name="Хожигдол" fill="#e5484d" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="card p-4">
              <h2 className="mb-3 font-semibold">Сар бүрийн тоглолтын тоо</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ left: 0, right: 8, top: 8 }}>
                    <CartesianGrid stroke="#1c2a44" vertical={false} />
                    <XAxis dataKey="month" {...axis} />
                    <YAxis {...axis} allowDecimals={false} width={30} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#1c2a44' }} />
                    <Bar dataKey="count" name="Тоглолт" fill="#d9a93a" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="card p-4">
            <h2 className="mb-3 font-semibold">Тоглогчийн гүйцэтгэл (нийт ба дундаж)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.players} margin={{ left: 8, right: 8, top: 8 }}>
                  <CartesianGrid stroke="#1c2a44" vertical={false} />
                  <XAxis dataKey="name" {...axis} interval={0} />
                  <YAxis {...axis} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={44} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#1c2a44' }} formatter={(v) => formatSigned(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="net" name="Нийт" fill="#34d27b" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="avgResult" name="Дундаж" fill="#f0c75e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
