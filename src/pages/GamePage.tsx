import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Crown, Download, Flag, Pencil, QrCode, Radio, Share2, Trash2, Undo2, Eye, Copy } from 'lucide-react';
import { Avatar, Button, Confirm, Empty, Modal } from '../components/ui';
import { useGame } from '../hooks/useData';
import { RoundForm } from '../features/games/RoundForm';
import { addRound, canUndo, deleteRound, finalizeGame, GameError, previewSettlement, standingsOf, undo, updateRound } from '../features/games/gameOps';
import { deleteGame, saveGame } from '../features/games/gameRepo';
import { blankEntries, entryDelta, roundWinner, type Standings } from '../features/scoring/engine';
import { SettlementView } from '../features/settlement/SettlementView';
import { refreshViewerCopy, shareGame, subscribeToGame } from '../features/multiplayer/sync';
import { isSupabaseConfigured } from '../lib/supabase';
import { useDrafts, useUi, type RoundDraftState } from '../stores/uiStore';
import type { Game, Round } from '../types';
import { formatDateTime, formatMoney, formatPoints } from '../utils/format';
import { download, gameToCsv, gameToJson, safeFileName } from '../utils/export';
import { uid } from '../utils/id';

function normalize(draft: RoundDraftState, before: Standings): RoundDraftState {
  return {
    ...draft,
    entries: draft.entries.map((e) => {
      const out = before.outAtRound[e.playerId] !== undefined;
      if (out) return { ...e, status: 'out', tricks: 0, boolt: false };
      if (e.status === 'out') return { ...e, status: 'played' };
      return e;
    }),
  };
}

const freshDraft = (g: Game, before: Standings): RoundDraftState => ({ id: uid(), entries: blankEntries(g.players.map((p) => p.playerId), before), instantWinPlayerId: null, note: '' });

export default function GamePage() {
  const { id } = useParams();
  const game = useGame(id);
  const navigate = useNavigate();
  const toast = useUi((s) => s.toast);
  const { drafts, setDraft, clearDraft } = useDrafts();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ round: Round; draft: RoundDraftState } | null>(null);
  const [deletingRound, setDeletingRound] = useState<Round | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [deletingGame, setDeletingGame] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string>('');

  const isViewer = game?.shared?.role === 'viewer';
  const remoteId = game?.shared?.remoteId;

  // Viewers: live updates from Supabase.
  useEffect(() => {
    if (!isViewer || !remoteId || !isSupabaseConfigured) return;
    return subscribeToGame(
      remoteId,
      () => void refreshViewerCopy(remoteId).catch((e) => setLiveStatus(`Алдаа: ${(e as Error).message}`)),
      setLiveStatus,
    );
  }, [isViewer, remoteId]);

  const standings = useMemo(() => (game ? standingsOf(game) : null), [game]);

  if (game === undefined) return <div className="py-20 text-center text-ink-400">Ачаалж байна…</div>;
  if (!game || !standings) return <Empty icon={<Flag size={40} />} title="Тоглолт олдсонгүй" action={<Link to="/">Нүүр хуудас руу</Link>} />;

  const active = game.status === 'active';
  const canEdit = active && !isViewer;
  const draft = canEdit ? normalize(drafts[game.id] ?? freshDraft(game, standings), standings) : null;
  const gp = (pid: string) => game.players.find((p) => p.playerId === pid)!;

  const commit = async (next: Game, msg?: string) => {
    await saveGame(next);
    if (msg) toast(msg);
  };
  const guard = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof GameError ? e.errors.join(' ') : (e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const submitRound = () =>
    guard(async () => {
      if (!draft) return;
      const next = addRound(game, draft);
      await commit(next, `Тойрог ${next.rounds.length} хадгалагдлаа`);
      clearDraft(game.id);
    });

  const ranking = [...game.players].sort((a, b) => standings.totals[a.playerId] - standings.totals[b.playerId]);
  const last = game.rounds[game.rounds.length - 1];
  const lastDeltas = last ? Object.fromEntries(last.entries.map((e) => [e.playerId, entryDelta(e, game.rules)])) : {};
  const preview = finishing ? previewSettlement(game) : null;
  const joinUrl = game.shared ? `${window.location.origin}/join/${game.shared.code}` : '';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">{game.name || 'Муушиг'}</h1>
          <p className="mt-1 text-sm text-ink-400">
            {formatDateTime(game.playedAt)} · Гарааны {formatMoney(game.stake)} · Боолт {formatMoney(game.booltAmount)} (×{game.rules.booltMultiplier})
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className={`rounded-full px-2.5 py-0.5 font-semibold ${active ? 'bg-felt-500/20 text-felt-400' : 'bg-ink-700 text-ink-300'}`}>{active ? 'Явагдаж байна' : 'Дууссан'}</span>
            {game.shared && (
              <span className="flex items-center gap-1 rounded-full bg-gold-900 px-2.5 py-0.5 font-semibold text-gold-400">
                {isViewer ? <Eye size={12} /> : <Radio size={12} />} {isViewer ? 'Үзэгч' : 'Хөтлөгч'} · {game.shared.code}
              </span>
            )}
            {isViewer && liveStatus && <span className={`rounded-full px-2.5 py-0.5 ${liveStatus === 'SUBSCRIBED' ? 'bg-felt-500/20 text-felt-400' : 'bg-ink-700 text-ink-300'}`}>{liveStatus === 'SUBSCRIBED' ? '● Шууд' : liveStatus === 'CHANNEL_ERROR' || liveStatus === 'TIMED_OUT' ? 'Дахин холбогдож байна…' : liveStatus}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isViewer && game.shared && (
            <Button variant="ghost" size="sm" onClick={() => setSharing(true)}>
              <QrCode size={16} /> Код
            </Button>
          )}
          {canEdit && !game.shared && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                isSupabaseConfigured
                  ? guard(async () => {
                      await shareGame(game);
                      setSharing(true);
                    })
                  : toast('Хуваалцах горимд Supabase тохиргоо хэрэгтэй. Тохиргоо хуудсыг үзнэ үү.', 'info')
              }
            >
              <Share2 size={16} /> Хуваалцах
            </Button>
          )}
          {canEdit && (
            <Button variant="ghost" size="sm" disabled={!canUndo(game) || busy} onClick={() => guard(async () => commit(undo(game), 'Буцаалаа'))}>
              <Undo2 size={16} /> Буцаах
            </Button>
          )}
        </div>
      </div>

      {/* Scoreboard */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {ranking.map((p, i) => {
          const total = standings.totals[p.playerId];
          const out = standings.outAtRound[p.playerId] !== undefined;
          const winner = (game.settlement?.winnerIds ?? (standings.finished ? standings.winnerIds : [])).includes(p.playerId);
          const loser = standings.finished && standings.loserIds.includes(p.playerId) && game.rules.endCondition === 'last_remaining';
          const progress = Math.max(0, Math.min(1, (total - game.rules.targetScore) / Math.max(1, game.rules.startingPoints - game.rules.targetScore)));
          const d = lastDeltas[p.playerId];
          return (
            <div key={p.playerId} className={`card relative overflow-hidden p-3 ${winner ? 'ring-2 ring-gold-500' : ''} ${loser ? 'ring-2 ring-ruby-500' : ''}`}>
              <div className="flex items-center gap-2">
                <Avatar avatar={p.avatar} color={p.color} name={p.name} size={30} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                {winner && <Crown size={16} className="text-gold-400" aria-label="Хожсон" />}
              </div>
              <div className="mt-2 flex items-end justify-between">
                <span className={`num text-4xl font-black leading-none ${out ? 'text-felt-400' : ''}`}>{total}</span>
                <span className="text-right text-xs">
                  {d !== undefined && d !== 0 && <span className={`num block font-semibold ${d < 0 ? 'text-felt-400' : 'text-ruby-400'}`}>{formatPoints(d)}</span>}
                  <span className="text-ink-400">{out ? 'Гарсан' : `#${i + 1}`}</span>
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-ink-700">
                <div className="h-full rounded-full bg-gradient-to-r from-felt-500 to-gold-500 transition-all" style={{ width: `${(1 - progress) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Game finished by rules but not yet settled */}
      {canEdit && standings.finished && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-gold-500/60 p-4">
          <div>
            <div className="font-semibold text-gold-400">Тоглолт дууслаа!</div>
            <div className="text-sm text-ink-300">
              {game.rules.endCondition === 'first_out' ? 'Хожсон: ' : 'Хожигдсон: '}
              {(game.rules.endCondition === 'first_out' ? standings.winnerIds : standings.loserIds).map((pid) => gp(pid).name).join(', ')}
            </div>
          </div>
          <Button variant="gold" onClick={() => setFinishing(true)}>
            <Flag size={18} /> Тооцоо хийх
          </Button>
        </div>
      )}

      {/* Round entry */}
      {canEdit && !standings.finished && draft && (
        <section className="card p-4 md:p-5">
          <h2 className="mb-3 font-semibold">Тойрог {game.rounds.length + 1}</h2>
          <RoundForm game={game} before={standings} draft={draft} onChange={(d) => setDraft(game.id, d)} onSubmit={submitRound} submitLabel="Тойрог хадгалах" busy={busy} />
        </section>
      )}

      {/* Settlement (finished games) */}
      {game.settlement && (
        <section className="card p-4 md:p-5">
          <h2 className="mb-3 font-semibold">Тооцоо</h2>
          <SettlementView game={game} settlement={game.settlement} />
        </section>
      )}

      {/* Rounds history */}
      <section className="card p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Тойргууд ({game.rounds.length})</h2>
        </div>
        {game.rounds.length === 0 ? (
          <p className="text-sm text-ink-400">Одоогоор тойрог бүртгээгүй байна.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-ink-400">
                  <th className="py-2 text-left font-medium">#</th>
                  {game.players.map((p) => (
                    <th key={p.playerId} className="py-2 text-center font-medium">
                      <span className="inline-block max-w-20 truncate align-middle">{p.name}</span>
                    </th>
                  ))}
                  {canEdit && <th />}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                <tr className="text-ink-400">
                  <td className="py-2">0</td>
                  {game.players.map((p) => (
                    <td key={p.playerId} className="num py-2 text-center">
                      {game.rules.startingPoints}
                    </td>
                  ))}
                  {canEdit && <td />}
                </tr>
                {game.rounds.map((r, i) => {
                  const w = roundWinner(r);
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="py-2 text-ink-400">
                        {r.number}
                        {r.note && <div className="max-w-24 truncate text-[11px]" title={r.note}>{r.note}</div>}
                      </td>
                      {game.players.map((p) => {
                        const e = r.entries.find((x) => x.playerId === p.playerId)!;
                        const d = entryDelta(e, game.rules);
                        return (
                          <td key={p.playerId} className={`num py-2 text-center ${w === p.playerId ? 'bg-felt-500/10' : ''}`}>
                            <div className="font-bold">{standings.history[i]?.[p.playerId] ?? '—'}</div>
                            <div className={`text-[11px] ${d < 0 ? 'text-felt-400' : d > 0 ? 'text-ruby-400' : 'text-ink-400'}`}>
                              {e.status === 'out' ? 'гарсан' : e.status === 'passed' ? `сугарсан ${d ? formatPoints(d) : ''}` : `${e.tricks} мөр ${formatPoints(d)}`}
                              {e.boolt && <span className="ml-0.5 font-bold text-gold-400">Б</span>}
                              {r.instantWinPlayerId === p.playerId && <span className="ml-0.5 font-bold text-gold-400">4Т</span>}
                            </div>
                          </td>
                        );
                      })}
                      {canEdit && (
                        <td className="whitespace-nowrap py-2 text-right">
                          <button
                            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-700 hover:text-white"
                            aria-label={`Тойрог ${r.number} засах`}
                            onClick={() => {
                              const before = standingsOf(game, game.rounds.slice(0, i));
                              setEditing({ round: r, draft: normalize({ id: r.id, entries: r.entries.map((e) => ({ ...e })), instantWinPlayerId: r.instantWinPlayerId, note: r.note }, before) });
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                          <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ruby-900 hover:text-ruby-400" aria-label={`Тойрог ${r.number} устгах`} onClick={() => setDeletingRound(r)}>
                            <Trash2 size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Footer actions */}
      <div className="flex flex-wrap gap-2">
        {canEdit && game.rounds.length > 0 && !standings.finished && (
          <Button variant="subtle" onClick={() => setFinishing(true)}>
            <Flag size={16} /> Тоглолтыг дуусгах
          </Button>
        )}
        <Button variant="ghost" onClick={() => download(`${safeFileName(game.name || 'muushig')}_${game.playedAt.slice(0, 10)}.csv`, gameToCsv(game), 'text/csv;charset=utf-8')}>
          <Download size={16} /> CSV
        </Button>
        <Button variant="ghost" onClick={() => download(`${safeFileName(game.name || 'muushig')}_${game.playedAt.slice(0, 10)}.json`, gameToJson(game), 'application/json')}>
          <Download size={16} /> JSON
        </Button>
        <Button variant="ghost" className="ml-auto text-ruby-400" onClick={() => setDeletingGame(true)}>
          <Trash2 size={16} /> {isViewer ? 'Энэ төхөөрөмжөөс хасах' : 'Тоглолт устгах'}
        </Button>
      </div>

      {/* Edit round */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Тойрог ${editing?.round.number ?? ''} засах`} wide>
        {editing && (
          <RoundForm
            game={game}
            before={standingsOf(game, game.rounds.slice(0, editing.round.number - 1))}
            draft={editing.draft}
            onChange={(d) => setEditing({ ...editing, draft: d })}
            busy={busy}
            submitLabel="Өөрчлөлт хадгалах"
            onSubmit={() =>
              guard(async () => {
                await commit(updateRound(game, editing.round.id, editing.draft), 'Тойрог засагдлаа');
                setEditing(null);
              })
            }
          />
        )}
      </Modal>

      <Confirm
        open={!!deletingRound}
        danger
        title="Тойрог устгах уу?"
        confirmLabel="Устгах"
        text={`Тойрог ${deletingRound?.number} устгагдаж, дараагийн тойргуудын дугаар шинэчлэгдэнэ. “Буцаах” товчоор сэргээж болно.`}
        onClose={() => setDeletingRound(null)}
        onConfirm={() => deletingRound && guard(async () => commit(deleteRound(game, deletingRound.id), 'Тойрог устгагдлаа'))}
      />

      <Confirm
        open={deletingGame}
        danger
        title="Тоглолт устгах уу?"
        confirmLabel="Устгах"
        text="Энэ тоглолтын бүх тойрог, тооцоо энэ төхөөрөмжөөс бүрмөсөн устгагдана."
        onClose={() => setDeletingGame(false)}
        onConfirm={async () => {
          await deleteGame(game.id);
          clearDraft(game.id);
          toast('Тоглолт устгагдлаа');
          navigate('/history');
        }}
      />

      {/* Settlement confirmation */}
      <Modal open={finishing} onClose={() => setFinishing(false)} title="Тооцоо баталгаажуулах" wide>
        {preview && (
          <>
            <SettlementView game={game} settlement={preview} />
            <p className="mt-4 text-sm text-ink-400">Баталгаажуулсны дараа тоглолт хаагдаж, түүхэнд өөрчлөгдөхгүйгээр хадгалагдана.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setFinishing(false)}>
                Буцах
              </Button>
              <Button
                variant="gold"
                disabled={busy}
                onClick={() =>
                  guard(async () => {
                    await commit(finalizeGame(game), 'Тоглолт дууслаа. Тооцоо хадгалагдлаа.');
                    clearDraft(game.id);
                    setFinishing(false);
                  })
                }
              >
                Баталгаажуулах
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Share */}
      <Modal open={sharing} onClose={() => setSharing(false)} title="Тоглолт хуваалцах">
        {game.shared && (
          <div className="flex flex-col items-center text-center">
            <div className="rounded-2xl bg-white p-4">
              <QRCodeSVG value={joinUrl} size={200} />
            </div>
            <div className="num mt-4 font-mono text-4xl font-black tracking-[0.3em] text-gold-400">{game.shared.code}</div>
            <p className="mt-2 text-sm text-ink-400">Бусад тоглогчид QR уншуулах эсвэл “Нэгдэх” хэсэгт кодыг оруулна. Тэд оноог шууд харах ба зөвхөн та засах эрхтэй.</p>
            <Button
              variant="subtle"
              className="mt-4"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(joinUrl);
                  toast('Холбоос хуулагдлаа');
                } catch {
                  toast(joinUrl, 'info');
                }
              }}
            >
              <Copy size={16} /> Холбоос хуулах
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
