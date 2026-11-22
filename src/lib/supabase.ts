import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when both public Supabase env vars are present. Only the anon key is ever used client-side. */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase тохируулаагүй байна. README-д заасны дагуу .env файлд VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY оруулна уу.');
  return supabase;
}

/** Ensures there is an (anonymous) auth session and returns the user id. */
export async function ensureSession(): Promise<string> {
  const sb = requireSupabase();
  const { data } = await sb.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: signed, error } = await sb.auth.signInAnonymously();
  if (error || !signed.user) {
    throw new Error(`Нэвтэрч чадсангүй: ${error?.message ?? 'тодорхойгүй алдаа'}. Supabase дээр Anonymous sign-in идэвхжүүлсэн эсэхийг шалгана уу.`);
  }
  return signed.user.id;
}
