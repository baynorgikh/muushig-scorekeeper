import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { Button, PageHeader } from '../components/ui';
import { isSupabaseConfigured } from '../lib/supabase';
import { joinByCode } from '../features/multiplayer/sync';

export default function JoinPage() {
  const { code: urlCode } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(urlCode?.toUpperCase() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tried = useRef(false);

  const join = async (c: string) => {
    setError(null);
    if (!/^[A-Z0-9]{6}$/.test(c)) {
      setError('Код 6 тэмдэгттэй байна.');
      return;
    }
    setBusy(true);
    try {
      const g = await joinByCode(c);
      navigate(`/game/${g.id}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (urlCode && isSupabaseConfigured && !tried.current) {
      tried.current = true;
      void join(urlCode.toUpperCase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode]);

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Тоглолтод нэгдэх" subtitle="Хөтлөгчийн дэлгэц дээрх 6 оронтой кодыг оруулна уу" />
      {!isSupabaseConfigured ? (
        <div className="card p-5 text-sm text-ruby-400">
          Хуваалцах горим идэвхгүй байна: энэ хувилбарт Supabase тохируулаагүй (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). Нэг төхөөрөмжийн горим хэвийн ажиллана.
        </div>
      ) : (
        <form
          className="card space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void join(code);
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            className="num w-full text-center font-mono text-3xl font-black tracking-[0.4em]"
            placeholder="ABC123"
            autoCapitalize="characters"
            autoComplete="off"
            aria-label="Нэгдэх код"
          />
          {error && <p className="text-sm text-ruby-400">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy || code.length !== 6}>
            <LogIn size={18} /> {busy ? 'Холбогдож байна…' : 'Нэгдэх'}
          </Button>
        </form>
      )}
    </div>
  );
}
