import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defaultData } from './data.js';
import { fetchWikiThumb, resolveWiki } from './wiki.js';
import * as api from './api.js';

const PAGE = 24;
const PH = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#EEF2EF"/><text x="320" y="210" font-family="sans-serif" font-size="22" fill="#6B7280" text-anchor="middle">Foto tidak tersedia</text></svg>');
const KATEGORI = [['semua', 'Semua'], ['hewan', '🐾 Fauna'], ['tumbuhan', '🌱 Flora'], ['jamur', '🍄 Jamur'], ['mikroba', '🦠 Mikroba']];
const STATUS = ['Dilindungi', 'Langka', 'Rentan', 'Terancam Punah', 'Kritis', 'Risiko Rendah', 'Belum Dievaluasi'];
const statusClass = (s) => 'status-' + String(s).toLowerCase().replace(/[^a-z]+/g, '-');
const isHttps = (u) => /^https:\/\//i.test(u || '');

// Foto: URL sendiri -> foto Wikipedia (dimuat saat mendekati layar) -> placeholder
function Img({ item, className }) {
  const ref = useRef(null);
  const [src, setSrc] = useState(isHttps(item.gambar) ? item.gambar : null);
  useEffect(() => {
    if (isHttps(item.gambar)) { setSrc(item.gambar); return; }
    setSrc(null);
    let off = false;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { io.disconnect(); fetchWikiThumb(item).then((s) => !off && setSrc(s || PH)); }
    }, { rootMargin: '300px' });
    io.observe(ref.current);
    return () => { off = true; io.disconnect(); };
  }, [item.gambar, item.nama_latin]); // eslint-disable-line
  const onError = () => { if (src !== PH) fetchWikiThumb(item).then((s) => setSrc(s && s !== src ? s : PH)); };
  return <img ref={ref} className={className} alt={item.nama} src={src || undefined} loading="lazy" onError={onError} />;
}

function Modal({ open, onClose, className = '', children }) {
  return (
    <div className={'modal-overlay' + (open ? ' active' : '')} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal-card ' + className}>{open && children}</div>
    </div>
  );
}

function Err({ msg }) { return msg ? <p className="form-error" role="alert">{msg}</p> : null; }

// ---------- Form spesimen ----------
function SpeciesForm({ init, onSaved, onClose, notify }) {
  const [f, setF] = useState({ nama: '', nama_latin: '', kategori: 'hewan', status: 'Dilindungi', habitat: '', gambar: '', deskripsi: '', ...init });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const p = { nama: f.nama.trim(), nama_latin: f.nama_latin.trim(), kategori: f.kategori, status: f.status, habitat: f.habitat.trim(), gambar: f.gambar.trim(), deskripsi: f.deskripsi.trim() };
    if (p.gambar && !isHttps(p.gambar)) return setErr('URL gambar harus diawali https://');
    setBusy(true); setErr('');
    try { await api.saveSpesies(p, init?.id); notify(init?.id ? 'Data spesies berhasil diperbarui!' : 'Spesies baru berhasil ditambahkan!'); onSaved(); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (<>
    <button className="modal-close" type="button" aria-label="Tutup" onClick={onClose}>&times;</button>
    <h3>{init?.id ? 'Ubah Spesimen' : 'Tambah Spesimen Baru'}</h3>
    <p className="form-sub">Masukkan informasi spesimen untuk memperkaya ensiklopedia.</p>
    <form className="app-form" onSubmit={submit}>
      <div className="form-row">
        <div className="field"><label>Nama Umum</label><input value={f.nama} onChange={set('nama')} maxLength={100} placeholder="Jalak Bali" required /></div>
        <div className="field"><label>Nama Latin</label><input value={f.nama_latin} onChange={set('nama_latin')} maxLength={100} placeholder="Leucopsar rothschildi" required /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>Kategori</label>
          <select value={f.kategori} onChange={set('kategori')}>
            <option value="hewan">Hewan (Fauna)</option><option value="tumbuhan">Tumbuhan (Flora)</option>
            <option value="jamur">Jamur (Fungi)</option><option value="mikroba">Mikroba</option>
          </select></div>
        <div className="field"><label>Status Konservasi</label>
          <select value={f.status} onChange={set('status')}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select></div>
      </div>
      <div className="field"><label>Habitat &amp; Wilayah Sebaran</label><input value={f.habitat} onChange={set('habitat')} maxLength={150} required /></div>
      <div className="field"><label>URL Gambar (HTTPS, opsional)</label><input type="url" value={f.gambar} onChange={set('gambar')} maxLength={500} placeholder="https://upload.wikimedia.org/..." /></div>
      <div className="field"><label>Ringkasan Informasi</label><textarea rows={3} value={f.deskripsi} onChange={set('deskripsi')} maxLength={2000} required /></div>
      <Err msg={err} />
      <button className="btn-submit" disabled={busy}>Simpan Spesimen</button>
    </form>
  </>);
}

// ---------- Masuk / daftar ----------
const score = (p) => Math.min([p.length >= 8, p.length >= 12, /[a-z]/.test(p) && /[A-Z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length, 4);
function PwInput({ value, onChange, ...rest }) {
  const [show, setShow] = useState(false);
  return (<div className="pw-wrap"><input type={show ? 'text' : 'password'} value={value} onChange={onChange} required {...rest} />
    <button type="button" className="pw-toggle" aria-pressed={show} aria-label="Tampilkan kata sandi" onClick={() => setShow(!show)}>👁</button></div>);
}
function AuthModalBody({ initialTab, onClose, notify }) {
  const [tab, setTab] = useState(initialTab);
  const [f, setF] = useState({ email: '', password: '', nama_lengkap: '', username: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const run = (fn) => async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await fn(); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const doLogin = run(async () => { await api.login(f.email.trim(), f.password); notify('Berhasil masuk.'); onClose(); });
  const doReg = run(async () => {
    const instan = await api.register({ ...f, email: f.email.trim() });
    notify(instan ? 'Akun berhasil dibuat.' : 'Akun dibuat. Cek email untuk konfirmasi, lalu masuk.'); onClose();
  });
  const sc = f.password ? score(f.password) : 0;
  const labels = ['Terlalu lemah', 'Lemah', 'Cukup', 'Kuat', 'Sangat kuat']; const colors = ['#DC2626', '#DC2626', '#F59E0B', '#65A30D', '#16A34A'];
  return (<>
    <button className="modal-close" type="button" aria-label="Tutup" onClick={onClose}>&times;</button>
    <div className="auth-tabs">
      <button className={'auth-tab' + (tab === 'login' ? ' active' : '')} onClick={() => { setTab('login'); setErr(''); }}>Masuk</button>
      <button className={'auth-tab' + (tab === 'daftar' ? ' active' : '')} onClick={() => { setTab('daftar'); setErr(''); }}>Buat Akun</button>
    </div>
    {tab === 'login' ? (
      <form className="auth-form" onSubmit={doLogin}>
        <div className="field"><label>Email</label><input type="email" value={f.email} onChange={set('email')} autoComplete="email" required /></div>
        <div className="field"><label>Kata Sandi</label><PwInput value={f.password} onChange={set('password')} autoComplete="current-password" /></div>
        <Err msg={err} /><button className="btn-submit" disabled={busy}>Masuk ke Akun</button>
      </form>
    ) : (
      <form className="auth-form" onSubmit={doReg}>
        <div className="field"><label>Nama Lengkap</label><input value={f.nama_lengkap} onChange={set('nama_lengkap')} maxLength={100} required /></div>
        <div className="field"><label>Username</label><input value={f.username} onChange={set('username')} pattern="[A-Za-z0-9_.\-]{3,50}" title="3-50 karakter: huruf, angka, titik, strip, underscore" required /></div>
        <div className="field"><label>Email</label><input type="email" value={f.email} onChange={set('email')} autoComplete="email" required /></div>
        <div className="field"><label>Kata Sandi (min. 8 karakter)</label><PwInput value={f.password} onChange={set('password')} minLength={8} autoComplete="new-password" />
          <div className="pw-meter"><span style={{ width: f.password ? Math.max(sc, 1) * 25 + '%' : 0, background: colors[sc] }} /></div>
          <small className="pw-hint">{f.password ? 'Kekuatan: ' + labels[sc] : 'Gunakan huruf besar, kecil, angka, dan simbol.'}</small></div>
        <Err msg={err} /><button className="btn-submit" disabled={busy}>Daftar Akun Baru</button>
      </form>
    )}
    <div className="google-box"><div className="divider"><span>atau</span></div>
      <button type="button" className="btn-secondary" style={{ width: '100%' }} onClick={() => api.loginGoogle().catch((x) => setErr(x.message))}>Lanjutkan dengan Google</button></div>
  </>);
}

// ---------- Aplikasi ----------
export default function App() {
  const [items, setItems] = useState(defaultData);
  const [live, setLive] = useState(api.configured);
  const [user, setUser] = useState(null);
  const [filter, setFilter] = useState('semua');
  const [q, setQ] = useState('');
  const [visible, setVisible] = useState(PAGE);
  const [detail, setDetail] = useState(null);
  const [wiki, setWiki] = useState(null);       // {title, newTab, src}
  const [form, setForm] = useState(null);       // {init}
  const [auth, setAuth] = useState(null);       // 'login' | 'daftar'
  const [hits, setHits] = useState(null);       // null | 'loading' | 'error' | []
  const [toast, setToast] = useState('');
  const timer = useRef();
  const notify = useCallback((m) => { setToast(m); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 3200); }, []);

  const load = useCallback(async () => {
    if (!api.configured) return;
    try { const d = await api.listSpesies(); setItems(d.length ? d : defaultData); setLive(true); }
    catch { setLive(false); setItems(defaultData); }
  }, []);
  useEffect(() => { load(); return api.configured ? api.watchUser(setUser) : undefined; }, [load]);

  useEffect(() => {
    const any = detail || wiki || form || auth;
    document.body.classList.toggle('modal-open', !!any);
    const esc = (e) => { if (e.key !== 'Escape') return; if (wiki) setWiki(null); else if (auth) setAuth(null); else if (form) setForm(null); else setDetail(null); };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, [detail, wiki, form, auth]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((it) => (filter === 'semua' || it.kategori === filter) && (!s || [it.nama, it.nama_latin, it.habitat].some((v) => String(v).toLowerCase().includes(s))));
  }, [items, filter, q]);
  const shown = filtered.slice(0, visible);
  const mine = (it) => !!user && it.user_id === user.id;

  const openWikiFor = async (it) => {
    setWiki({ title: `Wikipedia: ${it.nama} (mencari artikel...)`, newTab: '#', src: 'about:blank' });
    const r = await resolveWiki(it);
    const slug = r && r.title && encodeURIComponent(r.title.trim().replace(/ /g, '_'));
    setWiki((w) => !w ? w : slug
      ? { title: `Wikipedia: ${it.nama}${r.lang === 'en' ? ' (bahasa Inggris)' : ''}`, newTab: `https://${r.lang}.wikipedia.org/wiki/${slug}`, src: `https://${r.lang}.m.wikipedia.org/wiki/${slug}` }
      : { title: `Wikipedia: hasil pencarian "${it.nama_latin}"`, newTab: `https://id.wikipedia.org/w/index.php?search=${encodeURIComponent(it.nama_latin)}&ns0=1`, src: `https://id.m.wikipedia.org/w/index.php?search=${encodeURIComponent(it.nama_latin)}&ns0=1` });
  };
  const openWikiTitle = (t) => { const s = encodeURIComponent(t.replace(/ /g, '_')); setWiki({ title: 'Wikipedia: ' + t, newTab: `https://id.wikipedia.org/wiki/${s}`, src: `https://id.m.wikipedia.org/wiki/${s}` }); };

  const searchWiki = async () => {
    setHits('loading');
    const p = new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'search', gsrsearch: q.trim(), gsrlimit: '12', prop: 'pageimages|extracts', piprop: 'thumbnail', pithumbsize: '400', exintro: '1', explaintext: '1', exchars: '220' });
    try {
      const r = await fetch('https://id.wikipedia.org/w/api.php?' + p); if (!r.ok) throw 0;
      const j = await r.json(); setHits(Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index));
    } catch { setHits('error'); }
  };
  const addFromWiki = (h) => {
    if (!user) return notify('Masuk atau buat akun dulu untuk menambahkan spesimen.');
    setForm({ init: { nama: h.title, deskripsi: h.extract || '', gambar: h.thumbnail?.source || '' } });
  };
  const hapus = async () => {
    if (!confirm(`Hapus "${detail.nama}" dari ensiklopedia?`)) return;
    try { await api.removeSpesies(detail.id); setDetail(null); await load(); notify('Spesies berhasil dihapus!'); } catch (x) { notify(x.message); }
  };

  return (<>
    <header className="navbar"><div className="nav-container">
      <a href="#" className="brand"><span className="brand-logo">🌿</span><div className="brand-text"><span className="title">NusantaraBio</span><span className="subtitle">Ensiklopedia Alam Indonesia</span></div></a>
      <div className="nav-menu">{user && <button className="btn-nav" onClick={() => setForm({ init: null })}>+ Kontribusi</button>}</div>
      <div className="nav-user">
        {!api.configured ? null : user ? (<><span className="user-name">👋 {api.username(user)}</span><button className="btn-logout" onClick={() => api.logout().then(() => notify('Anda telah keluar.'))}>Keluar</button></>)
          : (<><button className="btn-login" onClick={() => setAuth('login')}>Masuk</button><button className="btn-register" onClick={() => setAuth('daftar')}>Buat Akun</button></>)}
      </div>
    </div></header>

    <main className="main-content">
      <section className="hero-section">
        <h1>Jelajah Keanekaragaman Hayati Nusantara</h1>
        <p>Dokumentasi flora, fauna, jamur, dan mikroba Indonesia yang terhubung langsung dengan referensi pengetahuan terbuka.</p>
        <div className="search-bar-container">
          <div className="search-input-wrap"><span aria-hidden>🔍</span>
            <input type="search" value={q} placeholder="Cari nama, nama latin, atau habitat..." aria-label="Cari spesimen" onChange={(e) => { setQ(e.target.value); setVisible(PAGE); setHits(null); }} /></div>
          <div className="filter-pills">{KATEGORI.map(([k, l]) => <button key={k} className={'pill' + (filter === k ? ' active' : '')} onClick={() => { setFilter(k); setVisible(PAGE); }}>{l}</button>)}</div>
        </div>
      </section>

      <section>
        <div className="catalog-header">
          <span aria-live="polite">Menampilkan {shown.length} dari {filtered.length} spesimen (total koleksi: {items.length})</span>
          {!live && <span className="conn-badge">{api.configured ? 'Server tidak terjangkau' : 'Mode offline'} · data contoh, hanya baca</span>}
        </div>
        <div className="species-grid">
          {filtered.length === 0 && <p className="empty-state">Spesimen tidak ditemukan di koleksi. Coba cari langsung di Wikipedia di bawah.</p>}
          {shown.map((it) => (
            <div key={it.id} className="card" role="button" tabIndex={0} aria-label={'Lihat detail ' + it.nama}
              onClick={() => setDetail(it)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setDetail(it))}>
              <Img item={it} className="card-img" />
              <div className="card-content">
                <span className="card-tag">{it.kategori}</span><h3 className="card-title">{it.nama}</h3><p className="card-latin">{it.nama_latin}</p>
                <div className="card-footer"><span>{it.habitat}</span><span className={'status-pill ' + statusClass(it.status)}>{it.status}</span></div>
              </div>
            </div>))}
        </div>
        {shown.length < filtered.length && <div className="load-more"><button className="btn-secondary" onClick={() => setVisible(visible + PAGE)}>Tampilkan lebih banyak</button></div>}

        {q.trim().length >= 2 && <div className="wiki-search"><button className="btn-wiki" onClick={searchWiki}>🔎 Cari "{q.trim()}" di Wikipedia</button></div>}
        {hits && <div className="wiki-results" aria-live="polite">
          {hits === 'loading' && <p className="empty-state">Mencari di Wikipedia...</p>}
          {hits === 'error' && <p className="empty-state">Tidak dapat menjangkau Wikipedia. Periksa koneksi internet Anda.</p>}
          {Array.isArray(hits) && !hits.length && <p className="empty-state">Tidak ada hasil di Wikipedia.</p>}
          {Array.isArray(hits) && hits.map((h) => (
            <article key={h.pageid} className="wr-card">
              {h.thumbnail ? <img src={h.thumbnail.source} alt={h.title} loading="lazy" /> : <div className="wr-noimg" />}
              <div className="wr-body"><h4>{h.title}</h4><p>{h.extract}</p>
                <div className="wr-actions"><button onClick={() => openWikiTitle(h.title)}>Baca</button>{api.configured && <button onClick={() => addFromWiki(h)}>+ Tambahkan</button>}</div></div>
            </article>))}
        </div>}
      </section>
    </main>

    <Modal open={!!detail} onClose={() => setDetail(null)} className="detail-card">
      {detail && (<>
        <button className="modal-close" aria-label="Tutup" onClick={() => setDetail(null)}>&times;</button>
        <div className="modal-body">
          <div className="modal-img-wrap"><Img item={detail} /></div>
          <div className="modal-info">
            <span className="badge-type">{detail.kategori.toUpperCase()}</span>
            <h2>{detail.nama}</h2><p className="latin-name">{detail.nama_latin}</p>
            <div className="info-grid">
              <div><span className="info-label">Status Konservasi</span><span className="info-val">{detail.status}</span></div>
              <div><span className="info-label">Habitat / Sebaran</span><span className="info-val">{detail.habitat}</span></div>
            </div>
            <p className="description-body">{detail.deskripsi}</p>
            <div className="modal-actions">
              <button className="btn-wiki" onClick={() => openWikiFor(detail)}>📖 Baca di Wikipedia</button>
              {mine(detail) && <div className="owner-actions"><button className="btn-secondary" onClick={() => { setForm({ init: detail }); setDetail(null); }}>Ubah</button><button className="btn-danger" onClick={hapus}>Hapus</button></div>}
            </div>
          </div>
        </div></>)}
    </Modal>

    <Modal open={!!wiki} onClose={() => setWiki(null)} className="wiki-card">
      {wiki && (<>
        <div className="wiki-header"><span id="wikiTitle">{wiki.title}</span>
          <div className="wiki-actions"><a href={wiki.newTab} target="_blank" rel="noopener noreferrer">Buka di tab baru ↗</a>
            <button className="modal-close-light" aria-label="Tutup" onClick={() => setWiki(null)}>&times;</button></div></div>
        <iframe id="wikiIframe" src={wiki.src} title="Halaman Wikipedia" referrerPolicy="no-referrer" />
      </>)}
    </Modal>

    <Modal open={!!form} onClose={() => setForm(null)} className="form-card">
      {form && <SpeciesForm init={form.init} notify={notify} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
    </Modal>

    <Modal open={!!auth} onClose={() => setAuth(null)} className="auth-card">
      {auth && <AuthModalBody initialTab={auth} notify={notify} onClose={() => setAuth(null)} />}
    </Modal>

    <div className={'toast' + (toast ? ' show' : '')} role="status" aria-live="polite">{toast}</div>
    <footer className="footer"><p>© 2026 NusantaraBio · Platform Edukasi Keanekaragaman Hayati Indonesia</p></footer>
  </>);
}
