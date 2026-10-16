// Upload foto spesimen dari perangkat ke Supabase Storage.
// Foto diperkecil dulu di browser (maks. 1600 px) supaya hemat kuota dan cepat.
import * as sb from './supabaseClient.js';

// Mengambil client Supabase apa pun nama ekspornya (supabase / default / client).
const client = sb.supabase || sb.default || sb.client || sb.supabaseClient || null;

export const BUCKET = 'spesimen';
export const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_INPUT = 10 * 1024 * 1024; // 10 MB sebelum dikompres
const MAX_SIDE = 1600;

export function validateFoto(file) {
  if (!file) return 'Pilih foto terlebih dahulu.';
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return 'Format foto harus JPG, PNG, atau WebP.';
  if (file.size > MAX_INPUT) return 'Ukuran foto terlalu besar (maksimal 10 MB).';
  return '';
}

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* lanjut ke cara lama */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Foto tidak bisa dibaca. Coba foto lain.')); };
    img.src = url;
  });
}

async function compress(file) {
  const img = await decode(file);
  const w0 = img.width || img.naturalWidth;
  const h0 = img.height || img.naturalHeight;
  const k = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w0 * k));
  canvas.height = Math.max(1, Math.round(h0 * k));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  if (img.close) img.close();
  const toBlob = (type, q) => new Promise((res) => canvas.toBlob(res, type, q));
  let blob = await toBlob('image/webp', 0.82);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', 0.85); // Safari lama
  if (!blob) throw new Error('Gagal memproses foto. Coba foto lain.');
  return blob;
}

const friendly = (m = '') => {
  if (/bucket not found/i.test(m)) return 'Penyimpanan foto belum disiapkan di server (jalankan storage.sql di Supabase).';
  if (/row-level security|not authorized|unauthorized|jwt/i.test(m)) return 'Anda tidak punya izin mengunggah. Coba keluar lalu masuk lagi.';
  if (/too large|payload|size/i.test(m)) return 'Ukuran foto terlalu besar untuk server.';
  return m || 'Gagal mengunggah foto.';
};

// Mengembalikan URL publik (https) dari foto yang sudah diunggah.
export async function uploadFoto(file) {
  const bad = validateFoto(file);
  if (bad) throw new Error(bad);
  if (!client || !client.storage) throw new Error('Server belum terhubung, tidak bisa mengunggah foto.');

  const { data: auth } = await client.auth.getUser();
  const uid = auth && auth.user && auth.user.id;
  if (!uid) throw new Error('Masuk dulu untuk mengunggah foto.');

  const blob = await compress(file);
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${uid}/${Date.now()}-${rand}.${ext}`;

  const { error } = await client.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
  if (error) throw new Error(friendly(error.message));

  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  if (!data || !/^https:\/\//i.test(data.publicUrl)) throw new Error('Foto terunggah tetapi alamatnya tidak valid.');
  return data.publicUrl;
}
