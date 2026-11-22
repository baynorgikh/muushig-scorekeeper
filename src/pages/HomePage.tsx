import { Link } from 'react-router-dom';
import { ArrowRight, Crown, LogIn, PlayCircle, PlusCircle, Spade } from 'lucide-react';
import { Avatar, Button, Empty, Stat } from '../components/ui';
import { useGames, usePlayers } from '../hooks/useData';
import { computeSummary } from '../features/statistics/stats';
import { standingsOf } from '../features/games/gameOps';
import { formatDate, formatMoney, formatSigned } from '../utils/format';
import { isSupabaseConfigured } from '../lib/supabase';

export default function HomePage() {
  const games = useGames();
  const players = usePlayers();
  if (!games || !players) return <div className="py-20 text-center text-ink-400">Ачаалж байна…</div>;

  const activeGames = games.filter((g) => g.status === 'active');
  const finished = games.filter((g) => g.status === 'finished').slice(0, 5);
  const summary = computeSummary(games);

  return (
    <div className="space-y-6">
      <section className="card suit-pattern relative overflow-hidden p-6 md:p-8">
        <div className="absolute -right-6 -top-6 rotate-12 text-[140px] leading-none text-felt-500/10 select-none" aria-hidden>
          ♠
        </div>
        <p className="text-sm font-medium uppercase tracking-widest text-gold-400">Сайн байна уу</p>
        <h1 className="mt-1 font-display text-3xl font-bold md:text-4xl">Муушиг оноо бүртгэгч</h1>
        <p className="mt-2 max-w-lg text-ink-300">Тойрог бүрийн оноо, боолт, эцсийн тооцоог автоматаар — 5 тоглогч, нэг утас эсвэл хүн бүр өөрийн утсаар.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/new">
            <Button variant="gold" size="lg">
              <PlusCircle size={20} /> Шинэ тоглолт
            </Button>
          </Link>
          {isSupabaseConfigured && (
            <Link to="/join">
              <Button variant="ghost" size="lg">
                <LogIn size={20} /> Кодоор нэгдэх
              </Button>
            </Link>
          )}
        </div>
      </section>

      {activeGames.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Үргэлжилж буй тоглолт</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {activeGames.map((g) => {
              const st = standingsOf(g);
              const leader = [...g.players].sort((a, b) => st.totals[a.playerId] - st.totals[b.playerId])[0];
              return (
                <Link key={g.id} to={`/game/${g.id}`} className="card group flex items-center gap-4 p-4 transition hover:border-felt-500/60">
                  <PlayCircle className="shrink-0 text-felt-400" size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{g.name || 'Муушиг'}</div>
                    <div className="text-sm text-ink-400">
                      {g.rounds.length} тойрог · Тэргүүлж буй: {leader.name} ({st.totals[leader.playerId]})
                    </div>
                    <div className="mt-2 flex -space-x-2">
                      {g.players.map((p) => (
                        <Avatar key={p.playerId} avatar={p.avatar} color={p.color} name={p.name} size={26} />
                      ))}
                    </div>
                  </div>
                  <ArrowRight className="text-ink-400 transition group-hover:translate-x-1 group-hover:text-white" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Нийт тоглолт" value={summary.totalGames} />
        <Stat label="Тоглогчид" value={players.length} />
        <Stat label="Их хожигч" value={summary.biggestWinner ? formatSigned(summary.biggestWinner.net) : '—'} tone="good" hint={summary.biggestWinner?.name} />
        <Stat label="Их хожигдогч" value={summary.biggestLoser ? formatSigned(summary.biggestLoser.net) : '—'} tone="bad" hint={summary.biggestLoser?.name} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Сүүлийн тоглолтууд</h2>
          <Link to="/history" className="text-sm text-felt-400 hover:underline">
            Бүгдийг харах
          </Link>
        </div>
        {finished.length === 0 ? (
          <Empty icon={<Spade size={40} />} title="Дууссан тоглолт алга" text={players.length < 5 ? 'Эхлээд 5 тоглогч бүртгээд шинэ тоглолт эхлүүлээрэй.' : 'Шинэ тоглолт эхлүүлээрэй.'} action={<Link to={players.length < 5 ? '/players' : '/new'}><Button>{players.length < 5 ? 'Тоглогч нэмэх' : 'Шинэ тоглолт'}</Button></Link>} />
        ) : (
          <div className="card divide-y divide-ink-700">
            {finished.map((g) => {
              const winners = g.settlement!.winnerIds.map((id) => g.players.find((p) => p.playerId === id)?.name).join(', ');
              const top = Math.max(...g.settlement!.players.map((p) => p.net));
              return (
                <Link key={g.id} to={`/game/${g.id}`} className="flex items-center gap-3 p-4 hover:bg-ink-800/60">
                  <Crown size={18} className="shrink-0 text-gold-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{winners}</div>
                    <div className="text-xs text-ink-400">
                      {g.name ? `${g.name} · ` : ''}
                      {formatDate(g.playedAt)} · {g.rounds.length} тойрог
                    </div>
                  </div>
                  <span className="num font-semibold text-felt-400">+{formatMoney(top)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
