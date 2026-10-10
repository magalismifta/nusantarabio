# NusantaraBio (Vite + React + Supabase)

Ensiklopedia flora & fauna Indonesia. Frontend React, backend Supabase (database + login), hosting GitHub Pages. Tanpa PHP.

## Menjalankan lokal
```
npm install
cp .env.example .env     # isi URL & anon key Supabase
npm run dev
```
Tanpa `.env`, situs tetap tampil dengan 105 data bawaan (hanya baca, tanpa login).

## Setup Supabase (sekali saja)
1. Buat project di supabase.com.
2. SQL Editor: jalankan `supabase/schema.sql`, lalu `supabase/seed.sql`.
3. Authentication → URL Configuration: isi *Site URL* dengan `https://USERNAME.github.io/NAMA-REPO/` dan tambahkan `http://localhost:5173` di Redirect URLs.
4. (Opsional) Authentication → Providers → Google. Untuk uji cepat, matikan "Confirm email" di provider Email.
5. Project Settings → API: salin **Project URL** dan **anon key**. Jangan pernah memakai `service_role` key di frontend.

## Deploy GitHub Pages
1. Push ke branch `main`.
2. Repo → Settings → Secrets and variables → Actions: tambah `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
3. Settings → Pages → Source: **GitHub Actions**. Setiap push akan build dan terbit otomatis.

Keamanan data dijaga Row Level Security di `schema.sql` (semua orang boleh baca; hanya pemilik boleh ubah/hapus), jadi anon key aman berada di kode publik.
