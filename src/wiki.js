const wikiMem = {};

async function wikiJson(url) {
    try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; }
}

function wikiFound(lang, j) {
    if (!j || !j.title || j.type === 'disambiguation') return null;
    return { lang, title: j.title, thumb: (j.thumbnail && j.thumbnail.source) || (j.originalimage && j.originalimage.source) || null };
}

// Sumber foto ketiga: Wikimedia Commons (hampir semua spesies punya foto di sini)
async function commonsThumb(term) {
    const j = await wikiJson('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
        action: 'query', format: 'json', origin: '*', generator: 'search', gsrnamespace: '6', gsrlimit: '10',
        gsrsearch: term, prop: 'imageinfo', iiprop: 'url', iiurlwidth: '500'
    }));
    const pages = Object.values((j && j.query && j.query.pages) || {}).sort((a, b) => a.index - b.index);
    for (const p of pages) {
        const ii = p.imageinfo && p.imageinfo[0];
        const title = p.title || '';
        if (!ii || !ii.thumburl) continue;
        if (!/\.(jpe?g|png|webp)$/i.test(title)) continue;                       // hanya foto
        if (/map|range|distribution|logo|icon|flag|diagram|chart/i.test(title)) continue; // bukan peta/diagram
        return ii.thumburl;
    }
    return null;
}

// Permintaan yang sedang berjalan dipakai bersama, supaya spesies yang sama tidak dicari berkali-kali
const wikiInflight = {};
function resolveWiki(item) {
    const k = item.nama_latin;
    if (!wikiInflight[k]) wikiInflight[k] = resolveWikiRaw(item).finally(() => { delete wikiInflight[k]; });
    return wikiInflight[k];
}

async function resolveWikiRaw(item) {
    const key = 'wikipage2:' + item.nama_latin;
    if (wikiMem[key] !== undefined && (wikiMem[key] === null || wikiMem[key].thumb)) return wikiMem[key];
    try { const c = localStorage.getItem(key); if (c) return (wikiMem[key] = JSON.parse(c)); } catch { /* storage diblokir */ }

    const slug = (t) => encodeURIComponent(t.trim().replace(/ /g, '_'));
    const summary = (lang, title) => wikiJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${slug(title)}?redirect=true`);
    const terms = [item.nama_latin, item.nama];
    let page = null;   // artikel yang akan dibuka (prioritas: bahasa Indonesia)
    let thumb = null;  // foto dari artikel mana pun yang cocok (id lalu en)
    const take = (lang, j, usePage = true) => {
        const f = wikiFound(lang, j);
        if (!f) return;
        if (usePage && !page) page = { lang: f.lang, title: f.title };
        if (!thumb && f.thumb) thumb = f.thumb;
    };

    // 1) Judul persis. Artikel bahasa Indonesia sering tanpa foto, jadi lanjut ke bahasa Inggris untuk fotonya.
    for (const lang of ['id', 'en']) {
        for (const t of terms) {
            if (page && thumb) break;
            take(lang, await summary(lang, t));
        }
    }
    // 2) Belum ada artikel sama sekali: pakai pencarian Wikipedia, ambil hasil teratas
    for (const lang of ['id', 'en']) {
        for (const t of terms) {
            if (page) break;
            const sr = await wikiJson(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=${encodeURIComponent(t)}`);
            const hit = sr && sr.query && sr.query.search && sr.query.search[0];
            if (hit) take(lang, await summary(lang, hit.title));
        }
    }

    // 3) Petunjuk pencarian foto (mis. produk fermentasi) bila artikel utama tanpa foto
    if (!thumb && item.cari_foto) {
        for (const lang of ['id', 'en']) {
            if (thumb) break;
            take(lang, await summary(lang, item.cari_foto), false);
        }
    }
    // 4) Masih tanpa foto: cari di Wikimedia Commons (nama latin, nama umum, lalu petunjuk)
    for (const t of [item.nama_latin, item.nama, item.cari_foto]) {
        if (thumb || !t) continue;
        thumb = await commonsThumb(t);
    }
    if (!thumb) console.info('Foto tidak ditemukan untuk:', item.nama_latin);

    const found = (page || thumb) ? { lang: page ? page.lang : null, title: page ? page.title : null, thumb } : null;
    wikiMem[key] = found;
    // Hanya simpan permanen bila foto ada, supaya yang belum berfoto dicoba lagi lain kali
    if (found && found.thumb) { try { localStorage.setItem(key, JSON.stringify(found)); } catch { /* abaikan */ } }
    return found;
}

async function fetchWikiThumb(item) {
    const r = await resolveWiki(item);
    return r && r.thumb ? r.thumb : null;
}

export { resolveWiki, fetchWikiThumb };
