import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoundForm } from '../src/features/games/RoundForm';
import { createGame, standingsOf } from '../src/features/games/gameOps';
import { blankEntries } from '../src/features/scoring/engine';
import { players, rules } from './helpers';
import type { RoundDraftState } from '../src/stores/uiStore';

function Harness({ onSubmit }: { onSubmit: () => void }) {
  const game = createGame({ name: '', playedAt: '2026-11-22T10:00:00.000Z', players: players(), rules: rules(), stake: 5000, booltAmount: 5000 });
  const before = standingsOf(game);
  const [draft, setDraft] = useState<RoundDraftState>({ id: 'x', entries: blankEntries(game.players.map((p) => p.playerId), before), instantWinPlayerId: null, note: '' });
  return <RoundForm game={game} before={before} draft={draft} onChange={setDraft} onSubmit={onSubmit} submitLabel="Хадгалах" />;
}

describe('RoundForm', () => {
  it('blocks saving until tricks add up and shows the боолт multiplier', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const save = screen.getByRole('button', { name: 'Хадгалах' });
    expect(save).toBeDisabled();
    expect(screen.getByText(/мөрийн нийлбэр 5 байх ёстой/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'A мөр нэмэх' }));
    await user.click(screen.getByRole('button', { name: 'A мөр нэмэх' }));
    await user.click(screen.getByRole('button', { name: 'B мөр нэмэх' }));
    await user.click(screen.getByRole('button', { name: 'C мөр нэмэх' }));
    await user.click(screen.getByRole('button', { name: 'D мөр нэмэх' }));
    expect(save).toBeEnabled();

    // E takes no trick → +5; with боолт ×2 → +10, and the multiplier badge appears.
    expect(screen.getByText('+5')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /Боолт ×2/ })[4]);
    expect(screen.getByText('+10')).toBeInTheDocument();
    expect(screen.getByText(/Боолт ×2 оноонд ба мөнгөнд нөлөөлнө/)).toBeInTheDocument();

    await user.click(save);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
