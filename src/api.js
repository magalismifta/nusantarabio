import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const sb = url && key ? createClient(url, key) : null;
export const configured = !!sb;

const COLS = 'id,nama,nama_latin,kategori,habitat,status,deskripsi,gambar,cari_foto,user_id';

function fail(error) {
  const m = { '23505': 'Spesies dengan nama latin tersebut sudah ada.', '23514': 'Data tidak memenuhi aturan (cek panjang teks & URL https).', '42501': 'Anda tidak berhak melakukan ini.' };
  const msg = m[error.code]
    || (/Invalid login/i.test(error.message) ? 'Email atau kata sandi salah.' : '')
    || (/already registered/i.test(error.message) ? 'Email sudah terdaftar.' : '')
    || error.message;
  return new Error(msg);
}
const ok = ({ data, error }) => { if (error) throw fail(error); return data; };

// ---- Spesies ----
export const listSpesies = async () => ok(await sb.from('spesies').select(COLS).order('id', { ascending: false }));
export async function saveSpesies(p, id) {
  const rows = ok(await (id ? sb.from('spesies').update(p).eq('id', id) : sb.from('spesies').insert(p)).select('id'));
  if (!rows.length) throw new Error('Data tidak ditemukan atau bukan milik Anda.');
}
export async function removeSpesies(id) {
  if (!ok(await sb.from('spesies').delete().eq('id', id).select('id')).length) throw new Error('Data tidak ditemukan atau bukan milik Anda.');
}

// ---- Auth ----
export const username = (u) => u?.user_metadata?.username || u?.user_metadata?.name || u?.email?.split('@')[0] || 'pengguna';
export function watchUser(cb) {
  sb.auth.getSession().then(({ data }) => cb(data.session?.user ?? null));
  const { data } = sb.auth.onAuthStateChange((_e, s) => cb(s?.user ?? null));
  return () => data.subscription.unsubscribe();
}
export async function login(email, password) { ok(await sb.auth.signInWithPassword({ email, password })); }
export async function register({ nama_lengkap, username, email, password }) {
  const d = ok(await sb.auth.signUp({ email, password, options: { data: { nama_lengkap, username } } }));
  return !!d.session; // false = perlu konfirmasi email
}
export const loginGoogle = async () => ok(await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }));
export const logout = async () => { await sb.auth.signOut(); };
