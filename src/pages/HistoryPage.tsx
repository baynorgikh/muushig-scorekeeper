import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Download, History as HistoryIcon, Search } from 'lucide-react';
import { Avatar, Button, Empty, PageHeader, Segmented } from '../components/ui';
import { useGames, usePlayers } from '../hooks/useData';
import { formatDateTime, formatMoney, formatSigned } from '../utils/format';
import { inRange, rangeFor } from '../features/statistics/stats';
import { download, gameToJson } from '../utils/export';

export default function HistoryPage() {
  const games = useGames();
  const players = usePlayers();
  const [q, setQ] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [status, setStatus] = useState<'all' | 'finished' | 'active'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const list = useMemo(() => {
    const range = rangeFor('custom', new Date(), { from, to });
    const query = q.trim().toLowerCase();
    return (games ?? []).filter(
      (g) =>
        (status === 'all' || g.status === status) &&
        (!playerId || g.players.some((p) => p.playerId === playerId)) &&
        inRange(g.playedAt, range) &&
        (!query || g.name.toLowerCase().includes(query) || g.players.some((p) => p.name.toLowerCase().includes(query))),
    );
  }, [games, q, playerId, status, from, to]);

  return (
    <div>
      <PageHeader
        title="Тоглолтын түүх"
        subtitle={`${list.length} тоглолт`}
        action={
          list.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => download(`muushig_tuukh_${new Date().toISOString().slice(0, 10)}.json`, `[${list.map(gameToJson).join(',\n')}]`, 'application/json')}>
              <Download size={16} /> JSON
            </Button>
          )
        }
      />

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Нэр эсвэл тоглогчоор хайх…" className="w-full pl-9" aria-label="Хайх" />
        </div>
        <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} aria-label="Тоглогчоор шүүх">
          <option value="">Бүх тоглогч</option>
          {players?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'Бүгд' },
            { value: 'finished', label: 'Дууссан' },
            { value: 'active', label: 'Идэвхтэй' },
          ]}
        />
        <label className="text-sm text-ink-400">
          Эхлэх огноо
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full" />
        </label>
        <label className="text-sm text-ink-400">
          Дуусах огноо
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full" />
        </label>
      </div>

      {games && list.length === 0 ? (
        <Empty icon={<HistoryIcon size={40} />} title="Тоглолт олдсонгүй" text="Шүүлтүүрээ өөрчилж үзнэ үү." />
      ) : (
        <div className="space-y-3">
          {list.map((g) => {
            const s = g.settlement;
            return (
              <Link key={g.id} to={`/game/${g.id}`} className="card block p-4 transition hover:border-felt-500/50">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{g.name || 'Муушиг'}</div>
                    <div className="text-xs text-ink-400">
                      {formatDateTime(g.playedAt)} · {g.rounds.length} тойрог · Гарааны {formatMoney(g.stake)}
                      {g.shared ? ` · ${g.shared.role === 'viewer' ? 'Үзэгч' : 'Хуваалцсан'}` : ''}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${g.status === 'active' ? 'bg-felt-500/20 text-felt-400' : 'bg-ink-700 text-ink-300'}`}>{g.status === 'active' ? 'Идэвхтэй' : 'Дууссан'}</span>
                </div>
                <div className="mt-3 grid grid-cols-5 gap-1.5">
                  {g.players.map((p) => {
                    const ps = s?.players.find((x) => x.playerId === p.playerId);
                    const won = s?.winnerIds.includes(p.playerId);
                    return (
                      <div key={p.playerId} className={`flex flex-col items-center rounded-xl p-1.5 text-center ${won ? 'bg-gold-900/60' : 'bg-ink-800/60'}`}>
                        <div className="relative">
                          <Avatar avatar={p.avatar} color={p.color} name={p.name} size={30} />
                          {won && <Crown size={13} className="absolute -right-1 -top-1 text-gold-400" />}
                        </div>
                        <span className="mt-1 w-full truncate text-[11px]">{p.name}</span>
                        {ps && <span className={`num text-[11px] font-bold ${ps.net > 0 ? 'text-felt-400' : ps.net < 0 ? 'text-ruby-400' : 'text-ink-400'}`}>{formatSigned(ps.net)}</span>}
                      </div>
                    );
                  })}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
