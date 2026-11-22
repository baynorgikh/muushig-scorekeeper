import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Camera } from 'lucide-react';
import { useRef } from 'react';
import { Avatar, Button } from '../../components/ui';
import { AVATARS, COLORS, imageToAvatar, playerSchema, type PlayerInput } from './playerRepo';

export function PlayerForm({ initial, onSubmit, onCancel, submitLabel = 'Хадгалах' }: { initial?: Partial<PlayerInput>; onSubmit: (v: PlayerInput) => Promise<void>; onCancel: () => void; submitLabel?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PlayerInput>({
    resolver: zodResolver(playerSchema),
    defaultValues: {
      name: initial?.name ?? '',
      avatar: initial?.avatar ?? AVATARS[Math.floor(Math.random() * AVATARS.length)],
      color: initial?.color ?? COLORS[Math.floor(Math.random() * COLORS.length)],
    },
  });
  const avatar = watch('avatar');
  const color = watch('color');
  const name = watch('name');

  const submit = handleSubmit(async (v) => {
    try {
      await onSubmit(v);
    } catch (e) {
      setError('name', { message: (e as Error).message });
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar avatar={avatar} color={color} name={name || '?'} size={64} />
        <div className="flex-1">
          <label className="label" htmlFor="pname">
            Нэр
          </label>
          <input id="pname" autoFocus autoComplete="off" className="w-full" placeholder="Жишээ: Бат" {...register('name')} />
          {errors.name && <p className="mt-1 text-sm text-ruby-400">{errors.name.message}</p>}
        </div>
      </div>
      <div>
        <div className="label">Аватар</div>
        <div className="flex flex-wrap gap-2">
          {AVATARS.map((a) => (
            <button key={a} type="button" onClick={() => setValue('avatar', a)} className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl ${avatar === a ? 'bg-felt-500/25 ring-2 ring-felt-500' : 'bg-ink-800 hover:bg-ink-700'}`} aria-label={`Аватар ${a}`}>
              {a}
            </button>
          ))}
          <button type="button" onClick={() => fileRef.current?.click()} className="flex h-10 items-center gap-1.5 rounded-xl bg-ink-800 px-3 text-sm hover:bg-ink-700">
            <Camera size={16} /> Зураг
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                setValue('avatar', await imageToAvatar(f));
              } catch (err) {
                setError('avatar', { message: (err as Error).message });
              }
            }}
          />
        </div>
        {errors.avatar && <p className="mt-1 text-sm text-ruby-400">{errors.avatar.message}</p>}
      </div>
      <div>
        <div className="label">Өнгө</div>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setValue('color', c)} className={`h-8 w-8 rounded-full ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-ink-850' : ''}`} style={{ background: c }} aria-label={`Өнгө ${c}`} />
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>
          Болих
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
