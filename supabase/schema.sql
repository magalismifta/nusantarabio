create table if not exists spesies (
  id         bigint generated always as identity primary key,
  nama       text not null check (char_length(nama) <= 100),
  nama_latin text not null unique check (char_length(nama_latin) <= 100),
  kategori   text not null check (kategori in ('hewan','tumbuhan','jamur','mikroba')),
  habitat    text not null check (char_length(habitat) <= 150),
  status     text not null check (status in ('Dilindungi','Langka','Rentan','Terancam Punah','Kritis','Risiko Rendah','Belum Dievaluasi')),
  deskripsi  text not null check (char_length(deskripsi) <= 2000),
  gambar     text not null default '' check (gambar = '' or gambar ~* '^https://'),
  cari_foto  text not null default '',
  user_id    uuid references auth.users(id) on delete cascade,  -- null = data bawaan
  created_at timestamptz not null default now()
);
alter table spesies enable row level security;
drop policy if exists baca on spesies;   create policy baca   on spesies for select using (true);
drop policy if exists tambah on spesies; create policy tambah on spesies for insert to authenticated with check (user_id = auth.uid());
drop policy if exists ubah on spesies;   create policy ubah   on spesies for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists hapus on spesies;  create policy hapus  on spesies for delete to authenticated using (user_id = auth.uid());
alter table spesies alter column user_id set default auth.uid();
