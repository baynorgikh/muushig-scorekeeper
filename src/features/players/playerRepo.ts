import { db } from '../../lib/db';
import type { Player } from '../../types';
import { uid } from '../../utils/id';
import { z } from 'zod';

export const AVATARS = ['🂡', '♠️', '♥️', '♦️', '♣️', '🐎', '🦅', '🐺', '🐫', '🦁', '🐉', '⭐', '🔥', '🎯', '👑', '🍀'];
export const COLORS = ['#22c55e', '#eab308', '#38bdf8', '#f472b6', '#a78bfa', '#fb923c', '#2dd4bf', '#f87171'];

export const playerSchema = z.object({
  name: z.string().trim().min(1, 'Нэр оруулна уу').max(40, 'Нэр хэт урт байна'),
  avatar: z.string().min(1).max(400_000, 'Зураг хэт том байна'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type PlayerInput = z.infer<typeof playerSchema>;

export async function addPlayer(input: PlayerInput): Promise<Player> {
  const data = playerSchema.parse(input);
  const exists = await db.players.filter((p) => p.name.toLowerCase() === data.name.toLowerCase()).first();
  if (exists) throw new Error('Ийм нэртэй тоглогч бүртгэлтэй байна.');
  const now = new Date().toISOString();
  const player: Player = { id: uid(), ...data, createdAt: now, updatedAt: now };
  await db.players.add(player);
  return player;
}

export async function updatePlayer(id: string, input: PlayerInput): Promise<void> {
  const data = playerSchema.parse(input);
  const dup = await db.players.filter((p) => p.id !== id && p.name.toLowerCase() === data.name.toLowerCase()).first();
  if (dup) throw new Error('Ийм нэртэй тоглогч бүртгэлтэй байна.');
  await db.players.update(id, { ...data, updatedAt: new Date().toISOString() });
}

/**
 * Deletes a player profile. Past games keep their own snapshot of the
 * player's name/avatar, so history is unaffected. Players in an active game cannot be deleted.
 */
export async function deletePlayer(id: string): Promise<void> {
  const active = await db.games.where('status').equals('active').filter((g) => g.players.some((p) => p.playerId === id)).count();
  if (active > 0) throw new Error('Идэвхтэй тоглолтод оролцож буй тоглогчийг устгах боломжгүй.');
  await db.players.delete(id);
}

/** Downscales an uploaded image to a small square JPEG data URL. */
export function imageToAvatar(file: File, size = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Зөвхөн зураг оруулна уу.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Зураг уншиж чадсангүй.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Зураг уншиж чадсангүй.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
