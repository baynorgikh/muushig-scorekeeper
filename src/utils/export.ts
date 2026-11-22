import type { Game } from '../types';
import { computeStandings, entryDelta } from '../features/scoring/engine';

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (cells: unknown[]) => cells.map(csvCell).join(',');

const statusMn = { played: 'Тоглосон', passed: 'Сугарсан', out: 'Гарсан' } as const;

/** CSV with three sections: rounds, totals/settlement, payments. UTF-8 BOM for Excel. */
export function gameToCsv(game: Game): string {
  const name = (id: string) => game.players.find((p) => p.playerId === id)?.name ?? id;
  const ids = game.players.map((p) => p.playerId);
  const st = computeStandings(ids, game.rounds, game.rules);
  const lines: string[] = [];
  lines.push(row(['Тоглолт', game.name || '', 'Огноо', game.playedAt, 'Гарааны', game.stake, 'Боолт', game.booltAmount, 'Үржвэр', game.rules.booltMultiplier]));
  lines.push('');
  lines.push(row(['Тойрог', 'Тоглогч', 'Төлөв', 'Мөр', 'Боолт', 'Засвар', 'Оноо', 'Нийт', 'Тэмдэглэл']));
  game.rounds.forEach((r, i) => {
    for (const e of r.entries) {
      lines.push(row([r.number, name(e.playerId), statusMn[e.status], e.tricks, e.boolt ? 'Тийм' : '', e.adjustment || '', entryDelta(e, game.rules), st.history[i]?.[e.playerId] ?? '', r.note]));
    }
  });
  if (game.settlement) {
    lines.push('');
    lines.push(row(['Тоглогч', 'Эцсийн оноо', 'Боолт', 'Төлөх', 'Авах', 'Цэвэр']));
    for (const p of game.settlement.players) lines.push(row([name(p.playerId), p.finalPoints, p.booltCount, p.pays, p.receives, p.net]));
    lines.push('');
    lines.push(row(['Төлөх хүн', 'Авах хүн', 'Дүн']));
    for (const p of game.settlement.payments) lines.push(row([name(p.from), name(p.to), p.amount]));
  }
  return '﻿' + lines.join('\n');
}

export function gameToJson(game: Game): string {
  const { undoStack: _undo, ...rest } = game;
  void _undo;
  return JSON.stringify(rest, null, 2);
}

export function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const safeFileName = (s: string) => s.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'muushig';
