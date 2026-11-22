import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Search, Trash2, Trophy, Users } from 'lucide-react';
import { Avatar, Button, Confirm, Empty, Modal, PageHeader } from '../components/ui';
import { useGames, usePlayers } from '../hooks/useData';
import { PlayerForm } from '../features/players/PlayerForm';
import { addPlayer, deletePlayer, updatePlayer } from '../features/players/playerRepo';
import { computeSummary } from '../features/statistics/stats';
import { useUi } from '../stores/uiStore';
import { formatDate, formatSigned, percent } from '../utils/format';
import type { Player } from '../types';

export default function PlayersPage() {
  const players = usePlayers();
  const games = useGames();
  const toast = useUi((s) => s.toast);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [deleting, setDeleting] = useState<Player | null>(null);
  const [viewing, setViewing] = useState<Player | null>(null);

  const stats = useMemo(() => new Map(computeSummary(games ?? []).players.map((p) => [p.playerId, p])), [games]);
  const filtered = (players ?? []).filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));

  const viewingGames = useMemo(
    () => (viewing ? (games ?? []).filter((g) => g.status === 'finished' && g.players.some((p) => p.playerId === viewing.id)).slice(0, 10) : []),
    [games, viewing],
  );

  return (
    <div>
      <PageHeader
        title="Тоглогчид"
        subtitle={`${players?.length ?? 0} бүртгэлтэй тоглогч`}
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus size={18} /> Нэмэх
          </Button>
        }
      />
      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Тоглогч хайх…" className="w-full pl-10" aria-label="Тоглогч хайх" />
      </div>

      {players && players.length === 0 ? (
        <Empty icon={<Users size={40} />} title="Тоглогч бүртгэгдээгүй байна" text="Муушиг 5 тоглогчтой тоглогддог. Эхлээд тоглогчдоо бүртгэнэ үү." action={<Button onClick={() => setAdding(true)}>Тоглогч нэмэх</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const s = stats.get(p.id);
            return (
              <div key={p.id} className="card animate-pop flex items-center gap-3 p-4">
                <button onClick={() => setViewing(p)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${p.name} статистик`}>
                  <Avatar avatar={p.avatar} color={p.color} name={p.name} size={48} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p.name}</div>
                    <div className="text-xs text-ink-400">
                      {s ? `${s.games} тоглолт · ${percent(s.winRate)} хожил` : 'Тоглолт байхгүй'}
                    </div>
                    {s && <div className={`num text-sm font-semibold ${s.net >= 0 ? 'text-felt-400' : 'text-ruby-400'}`}>{formatSigned(s.net)}</div>}
                  </div>
                </button>
                <button onClick={() => setEditing(p)} className="rounded-lg p-2 text-ink-400 hover:bg-ink-700 hover:text-white" aria-label="Засах">
                  <Pencil size={18} />
                </button>
                <button onClick={() => setDeleting(p)} className="rounded-lg p-2 text-ink-400 hover:bg-ruby-900 hover:text-ruby-400" aria-label="Устгах">
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && players && players.length > 0 && <p className="text-ink-400">“{q}” нэртэй тоглогч олдсонгүй.</p>}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Шинэ тоглогч">
        <PlayerForm
          submitLabel="Нэмэх"
          onCancel={() => setAdding(false)}
          onSubmit={async (v) => {
            await addPlayer(v);
            toast(`${v.name} нэмэгдлээ`);
            setAdding(false);
          }}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Тоглогч засах">
        {editing && (
          <PlayerForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={async (v) => {
              await updatePlayer(editing.id, v);
              toast('Хадгаллаа');
              setEditing(null);
            }}
          />
        )}
      </Modal>

      <Confirm
        open={!!deleting}
        danger
        title="Тоглогч устгах уу?"
        confirmLabel="Устгах"
        text={
          <>
            <b className="text-ink-100">{deleting?.name}</b> тоглогчийн профайл устгагдана. Өмнөх тоглолтуудын түүх өөрчлөгдөхгүй.
          </>
        }
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deletePlayer(deleting.id);
            toast('Устгагдлаа');
          } catch (e) {
            toast((e as Error).message, 'error');
          }
        }}
      />

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Тоглогчийн статистик" wide>
        {viewing && (
          <div>
            <div className="mb-4 flex items-center gap-3">
              <Avatar avatar={viewing.avatar} color={viewing.color} name={viewing.name} size={56} />
              <div className="text-xl font-bold">{viewing.name}</div>
            </div>
            {(() => {
              const s = stats.get(viewing.id);
              const cells = [
                ['Тоглолт', s?.games ?? 0],
                ['Хожил', s?.wins ?? 0],
                ['Хожигдол', s?.losses ?? 0],
                ['Хожлын хувь', percent(s?.winRate ?? 0)],
                ['Нийт ашиг/алдагдал', formatSigned(s?.net ?? 0)],
                ['Дундаж', formatSigned(s?.avgResult ?? 0)],
              ];
              return (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {cells.map(([l, v]) => (
                    <div key={l} className="rounded-xl bg-ink-800 p-3">
                      <div className="text-xs text-ink-400">{l}</div>
                      <div className="num text-lg font-bold">{v}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            <h3 className="mb-2 mt-5 font-semibold">Сүүлийн тоглолтууд</h3>
            {viewingGames.length === 0 && <p className="text-sm text-ink-400">Дууссан тоглолт алга.</p>}
            <ul className="divide-y divide-ink-700">
              {viewingGames.map((g) => {
                const ps = g.settlement?.players.find((x) => x.playerId === viewing.id);
                const won = g.settlement?.winnerIds.includes(viewing.id);
                return (
                  <li key={g.id}>
                    <Link to={`/game/${g.id}`} className="flex items-center justify-between py-2 hover:text-white">
                      <span className="flex items-center gap-2 text-sm">
                        {won && <Trophy size={14} className="text-gold-400" />}
                        {g.name || 'Тоглолт'} · {formatDate(g.playedAt)}
                      </span>
                      <span className={`num text-sm font-semibold ${(ps?.net ?? 0) >= 0 ? 'text-felt-400' : 'text-ruby-400'}`}>{formatSigned(ps?.net ?? 0)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  );
}
