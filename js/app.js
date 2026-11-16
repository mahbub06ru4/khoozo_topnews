/* =========================================================================
   Top News by Khoozo — app.js (vanilla, zero dependencies)
   - Dark/light theme with persistence
   - Reader settings: Bangla typeface + text size (persisted)
   - Live Bangla (Gregorian + Bangabda) / English date
   - Mega-menu navigation + logo carousel built from data/newspapers.json
   - Breaking ticker + live headlines from data/news.json
   - Live Sports: cricket + football headlines from data/sports.json
   - Directory as "TOP 10" category sections with Read More / Show More,
     category filter tabs, instant search, in-feed ad slots
   - Sticky mobile anchor ad with close button
   - Ad slots are filled by js/ads.js (configured in js/ads-config.js)
   ========================================================================= */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
  const toBn = (v) => String(v).replace(/\d/g, (d) => BN_DIGITS[d]);

  // Site root, resolved from this script's URL so every page (incl. 404) works.
  const ROOT = new URL('../', document.currentScript?.src || location.href);
  const HOME = ROOT.href;
  const dataUrl = (f) => new URL(`data/${f}`, ROOT).href;
  const IS_HOME = !!$('#paperGrid');
  const catHref = (id) => (IS_HOME ? `#cat=${id}` : `${HOME}#cat=${id}`);

  /** Tiny DOM builder — always uses textContent, so feed data can't inject HTML. */
  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v; // only used with static, trusted strings
      else el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }
  const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '#');
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const ext = { target: '_blank', rel: 'noopener noreferrer' };

  /* ---------------- Data (shared by nav + directory) ---------------- */
  let papersPromise;
  const loadPapers = () => (papersPromise ||= fetch(dataUrl('newspapers.json')).then((r) => {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }));

  /* ---------------- Theme ---------------- */
  function initTheme() {
    const root = document.documentElement;
    const btn = $('#themeToggle');
    const apply = (t) => {
      root.dataset.theme = t;
      btn?.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.content = t === 'dark' ? '#0b0b0f' : '#f6f4ef';
    };
    apply(root.dataset.theme || 'light');
    btn?.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(next);
      store.set('theme', next);
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', (e) => {
      if (!store.get('theme')) apply(e.matches ? 'dark' : 'light');
    });
  }

  /* ---------------- Reader settings: Bangla typeface + text size ---------------- */
  const FONTS = [['anek', 'আধুনিক', 'Modern'], ['hind', 'ক্লাসিক', 'Classic'], ['serif', 'সেরিফ', 'Serif']];
  const SIZES = [['sm', 'A', 'Small'], ['md', 'A', 'Default'], ['lg', 'A', 'Large']];

  function initReader() {
    const root = document.documentElement;
    const actions = $('.header-actions');
    if (!actions) return;
    const state = {
      font: FONTS.some(([id]) => id === root.dataset.font) ? root.dataset.font : 'anek',
      size: SIZES.some(([id]) => id === root.dataset.size) ? root.dataset.size : 'md',
    };
    const group = (key, opts, label) => h('div', { class: 'seg', role: 'group', 'aria-label': label },
      opts.map(([id, glyph, name]) => h('button', { type: 'button', [`data-${key}`]: id, 'aria-pressed': String(state[key] === id), title: name },
        h('b', key === 'font' ? { lang: 'bn' } : {}, glyph), h('small', {}, name))));
    const pop = h('div', { class: 'reader-pop', id: 'readerPop', hidden: '' },
      h('h3', {}, 'Bangla font · বাংলা ফন্ট'), group('font', FONTS, 'Bangla font'),
      h('h3', {}, 'Text size · লেখার আকার'), group('size', SIZES, 'Text size'));
    const btn = h('button', { class: 'icon-btn', id: 'readerToggle', type: 'button', 'aria-label': 'Font and text size', 'aria-expanded': 'false', 'aria-controls': 'readerPop' }, 'Aa');
    actions.insertBefore(btn, $('#themeToggle', actions));
    actions.append(pop);

    const setOpen = (open) => { pop.hidden = !open; btn.setAttribute('aria-expanded', String(open)); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(pop.hidden); });
    document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { setOpen(false); btn.focus(); } });
    pop.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const key = b.dataset.font ? 'font' : 'size';
      state[key] = b.dataset[key];
      // The defaults are stored as "no attribute" so the CSS fallbacks apply.
      const isDefault = state[key] === (key === 'font' ? 'anek' : 'md');
      if (isDefault) delete root.dataset[key]; else root.dataset[key] = state[key];
      store.set(key, isDefault ? '' : state[key]);
      $$(`[data-${key}]`, pop).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
  }

  /* ---------------- Dates ---------------- */
  const BN_MONTHS = ['বৈশাখ', 'জ্যৈষ্ঠ', 'আষাঢ়', 'শ্রাবণ', 'ভাদ্র', 'আশ্বিন', 'কার্তিক', 'অগ্রহায়ণ', 'পৌষ', 'মাঘ', 'ফাল্গুন', 'চৈত্র'];
  const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

  /** Bangabda per the revised Bangladesh calendar (2019): starts 14 April. */
  function bangabda(date) {
    const y = date.getFullYear();
    const start = new Date(y, 3, 14);
    const base = date >= start ? start : new Date(y - 1, 3, 14);
    const bnYear = base.getFullYear() - 593;
    const lens = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, isLeap(base.getFullYear() + 1) ? 30 : 29, 30];
    let days = Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - base) / 864e5);
    let m = 0;
    while (m < 11 && days >= lens[m]) { days -= lens[m]; m++; }
    return `${toBn(days + 1)} ${BN_MONTHS[m]} ${toBn(bnYear)} বঙ্গাব্দ`;
  }

  function initDate() {
    const bnEl = $('#dateBn');
    const enEl = $('#dateEn');
    if (!bnEl && !enEl) return;
    const tz = 'Asia/Dhaka';
    const render = () => {
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
      if (bnEl) {
        const g = new Intl.DateTimeFormat('bn-BD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
        bnEl.textContent = `${g} · ${bangabda(now)}`;
      }
      if (enEl) {
        enEl.textContent = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date()) + ' (BST)';
      }
    };
    render();
    setInterval(render, 30000);
  }

  /* ---------------- Relative time ---------------- */
  function relTime(iso, lang) {
    const diff = (Date.parse(iso) - Date.now()) / 1000;
    if (!Number.isFinite(diff)) return '';
    const rtf = new Intl.RelativeTimeFormat(lang === 'bn' ? 'bn-BD' : 'en', { numeric: 'auto', style: 'short' });
    const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [u, s] of units) if (Math.abs(diff) >= s) return rtf.format(Math.round(diff / s), u);
    return lang === 'bn' ? 'এইমাত্র' : 'just now';
  }

  /* ---------------- Logos ---------------- */
  const PALETTE = ['#d71920', '#0b6e4f', '#1d4ed8', '#7c3aed', '#c2410c', '#0e7490', '#be185d', '#4d7c0f'];
  const colorFor = (p) => p.color || PALETTE[[...hostOf(p.url)].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

  /** Small favicon <img>; removes itself if the icon is missing or a generic globe. */
  function favicon(p, size = 32) {
    const host = hostOf(p.url);
    if (!host) return null;
    const img = h('img', {
      class: 'fav', src: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`,
      alt: '', width: size, height: size, loading: 'lazy', decoding: 'async',
    });
    img.addEventListener('error', () => img.remove(), { once: true });
    img.addEventListener('load', () => { if (img.naturalWidth && img.naturalWidth < 20) img.remove(); }, { once: true });
    return img;
  }

  /** Logo tile: real logo image if `logo` is set in JSON, otherwise a coloured Bangla wordmark. */
  function logoTile(p, q) {
    const tile = h('span', { class: 'paper-logo', style: `--c:${colorFor(p)}` });
    if (p.logo) {
      const img = h('img', { class: 'logo-img', src: new URL(p.logo, ROOT).href, alt: p.name_en, loading: 'lazy', decoding: 'async', height: 48 });
      img.addEventListener('error', () => img.replaceWith(wordmark(p, q)), { once: true });
      tile.append(img);
    } else {
      tile.append(favicon(p) || '', wordmark(p, q));
    }
    return tile;
  }
  function wordmark(p, q) {
    const len = [...p.name_bn].length;
    return h('span', { class: `wm${len > 14 ? ' wm-sm' : len > 9 ? ' wm-md' : ''}`, lang: 'bn' }, highlight(p.name_bn, q));
  }

  function highlight(text, q) {
    if (!q) return text;
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return text;
    const frag = document.createDocumentFragment();
    frag.append(text.slice(0, i), h('mark', {}, text.slice(i, i + q.length)), text.slice(i + q.length));
    return frag;
  }

  /* ---------------- Mega menu ---------------- */
  async function initNav() {
    const nav = $('#mainNav');
    if (!nav) return;
    const items = $$('.mn-item', nav);
    const close = (except) => items.forEach((it) => {
      if (it === except) return;
      it.classList.remove('open');
      $('.mn-btn', it)?.setAttribute('aria-expanded', 'false');
    });
    const toggle = (it, force) => {
      const open = force ?? !it.classList.contains('open');
      close(it);
      it.classList.toggle('open', open);
      $('.mn-btn', it).setAttribute('aria-expanded', String(open));
    };
    const hoverable = matchMedia('(hover: hover) and (pointer: fine)');
    items.forEach((it) => {
      $('.mn-btn', it).addEventListener('click', (e) => { e.stopPropagation(); toggle(it); });
      let t;
      it.addEventListener('mouseenter', () => { if (hoverable.matches) { clearTimeout(t); toggle(it, true); } });
      it.addEventListener('mouseleave', () => { if (hoverable.matches) t = setTimeout(() => toggle(it, false), 150); });
      it.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
    });
    document.addEventListener('click', (e) => { if (!nav.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    // Fix home/category links so they work from every page (incl. 404).
    $$('a[data-home]', nav).forEach((a) => { a.href = HOME; });
    $$('a[data-sports]', nav).forEach((a) => { a.setAttribute('href', IS_HOME ? '#sports' : `${HOME}#sports`); });
    $$('a[data-cat]', nav).forEach((a) => { a.setAttribute('href', catHref(a.dataset.cat)); });

    let data;
    try { data = await loadPapers(); } catch { return; }
    const cats = data.categories.filter((c) => c.id !== 'all');
    const by = (id) => data.newspapers.filter((p) => p.category === id);
    const link = (p) => h('li', {}, h('a', { href: safeUrl(p.url), ...ext }, favicon(p, 16) || '', h('span', { lang: 'bn' }, p.name_bn)));

    const megaAll = $('#mega-all');
    if (megaAll) {
      megaAll.replaceChildren(h('div', { class: 'mega-grid' }, cats.map((c) => {
        const list = by(c.id);
        return h('div', { class: 'mega-col' },
          h('a', { class: 'mega-head', href: catHref(c.id) }, h('span', { lang: 'bn' }, c.bn), h('small', {}, `${c.en} · ${list.length}`)),
          h('ul', {}, list.slice(0, 6).map(link)),
          list.length > 6 ? h('a', { class: 'mega-more', href: catHref(c.id) }, `সব ${toBn(list.length)}টি দেখুন →`) : null);
      })));
    }
    const megaLocal = $('#mega-local');
    if (megaLocal) {
      const local = by('local');
      // Only divisions that have at least one paper (add more in data/newspapers.json).
      megaLocal.replaceChildren(h('div', { class: 'mega-grid' }, (data.divisions || []).map((d) => {
        const list = local.filter((p) => p.division === d.id);
        if (!list.length) return null;
        return h('div', { class: 'mega-col' },
          h('a', { class: 'mega-head', href: catHref('local') }, h('span', { lang: 'bn' }, `${d.bn} বিভাগ`), h('small', {}, `${d.en} Division`)),
          h('ul', {}, list.map(link)));
      })));
    }
  }

  /* ---------------- Logo carousel ---------------- */
  async function initStrip() {
    const strip = $('#logoStrip');
    if (!strip) return;
    let data;
    try { data = await loadPapers(); } catch { return; }
    // A few top picks from each Bangladeshi category.
    const picks = ['bangla', 'online', 'tv', 'english', 'international']
      .flatMap((id) => data.newspapers.filter((p) => p.category === id).slice(0, id === 'bangla' ? 8 : 5));
    strip.replaceChildren(...picks.map((p) => h('a', { class: 'chip', href: safeUrl(p.url), ...ext, title: p.name_en, style: `--c:${colorFor(p)}` },
      favicon(p, 20) || '', h('span', { lang: 'bn' }, p.name_bn))));
    const step = () => Math.max(200, strip.clientWidth * 0.8);
    $('#stripPrev')?.addEventListener('click', () => strip.scrollBy({ left: -step(), behavior: 'smooth' }));
    $('#stripNext')?.addEventListener('click', () => strip.scrollBy({ left: step(), behavior: 'smooth' }));
  }

  /* ---------------- Live news ---------------- */
  async function loadNews() {
    const grid = $('#liveGrid');
    const ticker = $('#tickerMove');
    if (!grid && !ticker) return;
    try {
      // Cache-bust every 5 minutes so GitHub Pages' CDN copy refreshes regularly.
      const res = await fetch(`${dataUrl('news.json')}?v=${Math.floor(Date.now() / 3e5)}`);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      const items = (data.items || []).filter((i) => i && i.title && i.link);
      if (!items.length) throw new Error('empty');

      if (ticker) {
        const links = items.map((it) => h('a', { href: safeUrl(it.link), ...ext, lang: it.lang }, it.title));
        // Duplicate the list for a seamless -50% loop; the copy is hidden from AT.
        const copy = links.map((a) => { const c = a.cloneNode(true); c.tabIndex = -1; c.setAttribute('aria-hidden', 'true'); return c; });
        ticker.replaceChildren(...links, ...copy);
        ticker.style.setProperty('--ticker-dur', `${Math.max(40, items.length * 7)}s`);
      }
      if (grid) {
        grid.replaceChildren(...items.slice(0, 9).map((it) => h('li', {},
          h('a', { class: 'live-card', href: safeUrl(it.link), ...ext },
            h('h3', { lang: it.lang }, it.title),
            h('div', { class: 'live-meta' },
              h('span', { class: 'src-badge' }, it.source || 'Google News'),
              h('time', { datetime: it.pubDate, lang: it.lang }, relTime(it.pubDate, it.lang)))))));
      }
      const upd = $('#newsUpdated');
      if (upd && data.updated) {
        upd.textContent = `আপডেট: ${relTime(data.updated, 'bn')}`;
        upd.title = new Date(data.updated).toLocaleString();
      }
    } catch (err) {
      console.warn('Live news unavailable:', err);
      grid?.replaceChildren(h('li', { class: 'empty' }, 'লাইভ শিরোনাম এই মুহূর্তে পাওয়া যাচ্ছে না। Live headlines are temporarily unavailable.'));
      ticker?.replaceChildren(h('a', { href: 'https://news.google.com/?hl=bn&gl=BD&ceid=BD:bn', ...ext }, 'সর্বশেষ খবর দেখুন Google News-এ'));
    }
  }

  /* ---------------- Live sports (cricket + football headlines) ---------------- */
  const SPORT_LABEL = { cricket: '🏏 Cricket', football: '⚽ Football' };
  let sportItems = [];
  let sportFilter = 'all';

  function renderSports() {
    const grid = $('#sportsGrid');
    if (!grid) return;
    const list = sportItems.filter((it) => sportFilter === 'all' || it.sport === sportFilter).slice(0, 8);
    if (!list.length) {
      grid.replaceChildren(h('li', { class: 'empty' }, 'এই মুহূর্তে কোনো খেলার খবর নেই। No sports headlines right now.'));
      return;
    }
    grid.replaceChildren(...list.map((it) => h('li', {},
      h('a', { class: `live-card sport-${it.sport}`, href: safeUrl(it.link), ...ext, 'data-sport': SPORT_LABEL[it.sport] || 'Sports' },
        h('h3', { lang: it.lang }, it.title),
        h('div', { class: 'live-meta' },
          h('span', { class: 'src-badge' }, it.source || 'Google News'),
          h('time', { datetime: it.pubDate, lang: it.lang }, relTime(it.pubDate, it.lang)))))));
  }

  async function loadSports() {
    const grid = $('#sportsGrid');
    if (!grid) return;
    try {
      const res = await fetch(`${dataUrl('sports.json')}?v=${Math.floor(Date.now() / 3e5)}`);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      sportItems = (data.items || []).filter((i) => i && i.title && i.link);
      if (!sportItems.length) throw new Error('empty');
      renderSports();
      const upd = $('#sportsUpdated');
      if (upd && data.updated) {
        upd.textContent = `আপডেট: ${relTime(data.updated, 'bn')}`;
        upd.title = new Date(data.updated).toLocaleString();
      }
    } catch (err) {
      console.warn('Sports headlines unavailable:', err);
      grid.replaceChildren(h('li', { class: 'empty' }, 'খেলার খবর এই মুহূর্তে পাওয়া যাচ্ছে না — উপরের লাইভ স্কোর লিংক ব্যবহার করুন। Sports headlines are temporarily unavailable.'));
    }
  }

  function initSports() {
    const filter = $('#sportFilter');
    if (!filter) return;
    filter.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sport]');
      if (!b) return;
      sportFilter = b.dataset.sport;
      $$('[data-sport]', filter).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      renderSports();
    });
    loadSports();
  }

  /* ---------------- Newspaper directory ---------------- */
  const TOP_N = 10;      // cards shown per section before "Show More"
  const AD_EVERY = 12;   // in-feed ad after every 12 cards inside a grid
  const AD_SECTIONS = 2; // in-feed ad between every 2 sections

  function inFeedAd(n) {
    // The network is chosen in js/ads-config.js; js/ads.js fills the box.
    if (window.KhoozoAds?.enabled === false) return null;
    const el = h('div', { class: 'ad-slot ad-infeed', 'data-ad-type': 'infeed', 'data-ad-id': `infeed-${n}`, role: 'complementary', 'aria-label': 'Advertisement' });
    return window.KhoozoAds?.fill(el) === false ? null : el;
  }

  function paperCard(p, { cat, div, q, showTag }) {
    const tag = div ? `${div.bn} বিভাগ` : showTag && cat ? cat.bn : null;
    return h('a', { class: 'paper', style: `--c:${colorFor(p)}`, href: safeUrl(p.url), ...ext, title: `${p.name_en} — ${hostOf(p.url)}` },
      logoTile(p, q),
      h('span', { class: 'paper-en' }, highlight(p.name_en, q)),
      tag ? h('span', { class: 'paper-tag', lang: 'bn' }, tag) : null);
  }

  async function initDirectory() {
    const wrap = $('#paperGrid');
    const tabs = $('#catTabs');
    const search = $('#searchInput');
    const status = $('#dirStatus');
    if (!wrap) return;

    let data;
    try { data = await loadPapers(); } catch {
      wrap.replaceChildren(h('p', { class: 'empty' }, 'তালিকা লোড করা যায়নি। Please refresh the page.'));
      return;
    }
    const cats = data.categories;
    const catMap = Object.fromEntries(cats.map((c) => [c.id, c]));
    const divMap = Object.fromEntries((data.divisions || []).map((d) => [d.id, d]));
    const papers = data.newspapers.map((p) => ({ ...p, _q: `${p.name_bn} ${p.name_en} ${hostOf(p.url)}`.toLowerCase() }));
    const sectionCats = cats.filter((c) => c.id !== 'all' && papers.some((p) => p.category === c.id));

    // ---- Build all category sections once ----
    let adN = 0;
    const sections = {};
    const sectionNodes = [];
    sectionCats.forEach((c, si) => {
      const list = papers.filter((p) => p.category === c.id);
      const grid = h('div', { class: 'paper-grid' });
      list.forEach((p, i) => {
        const card = paperCard(p, { cat: c, div: divMap[p.division] });
        if (i >= TOP_N) card.classList.add('extra');
        grid.append(card);
        if ((i + 1) % AD_EVERY === 0 && i + 1 < list.length) {
          const ad = inFeedAd(++adN);
          if (ad) {
            if (i >= TOP_N) ad.classList.add('extra');
            grid.append(ad);
          }
        }
      });

      const intro = h('div', { class: 'cat-intro', id: `intro-${c.id}` },
        c.intro_bn ? h('p', { lang: 'bn' }, c.intro_bn) : null,
        c.intro_en ? h('p', { lang: 'en' }, c.intro_en) : null);
      const readBtn = h('button', { class: 'read-more', type: 'button', 'aria-expanded': 'false', 'aria-controls': intro.id }, 'Read More');
      readBtn.addEventListener('click', () => {
        const open = intro.classList.toggle('open');
        readBtn.setAttribute('aria-expanded', String(open));
        readBtn.textContent = open ? 'Read Less' : 'Read More';
      });

      const hiddenCount = Math.max(0, list.length - TOP_N);
      const moreBtn = hiddenCount
        ? h('button', { class: 'show-more', type: 'button', 'aria-expanded': 'false' }, `আরও ${toBn(hiddenCount)}টি দেখুন ↓ · Show More`)
        : null;
      const sec = h('section', { class: 'cat-sec', id: `sec-${c.id}`, 'aria-labelledby': `h-${c.id}` },
        h('h2', { class: 'cat-title', id: `h-${c.id}` },
          h('span', { lang: 'bn' }, `${list.length >= TOP_N ? 'সেরা ১০' : 'সেরা'} ${c.bn}`),
          h('small', {}, `${list.length >= TOP_N ? 'Top 10 ' : 'Top '}${c.title_en || c.en}`)),
        h('div', { class: 'cat-intro-wrap' }, intro, readBtn),
        grid,
        h('div', { class: 'sec-actions' },
          moreBtn,
          h('a', { class: 'sec-link', href: `#cat=${c.id}` }, `সব ${c.bn} (${toBn(list.length)}) →`)));
      moreBtn?.addEventListener('click', () => setExpanded(c.id, !sec.classList.contains('expanded')));

      sections[c.id] = { sec, moreBtn, hiddenCount, count: list.length };
      sectionNodes.push(sec);
      if ((si + 1) % AD_SECTIONS === 0 && si + 1 < sectionCats.length) {
        const ad = inFeedAd(`sec-${si}`);
        if (ad) {
          ad.classList.add('between-sec');
          sectionNodes.push(ad);
        }
      }
    });

    function setExpanded(id, on) {
      const s = sections[id];
      if (!s) return;
      s.sec.classList.toggle('expanded', on);
      if (s.moreBtn) {
        s.moreBtn.setAttribute('aria-expanded', String(on));
        s.moreBtn.textContent = on ? 'কম দেখুন ↑ · Show Less' : `আরও ${toBn(s.hiddenCount)}টি দেখুন ↓ · Show More`;
      }
    }

    const resultsGrid = h('div', { class: 'paper-grid search-results', hidden: '' });
    wrap.replaceChildren(resultsGrid, ...sectionNodes);

    // ---- Tabs ----
    const fromHash = () => (location.hash.match(/cat=([a-z]+)/) || [])[1];
    let current = catMap[fromHash()] ? fromHash() : 'all';

    tabs.replaceChildren(...cats.map((c) => {
      const count = c.id === 'all' ? papers.length : papers.filter((p) => p.category === c.id).length;
      return h('button', { class: 'tab', role: 'tab', type: 'button', 'data-cat': c.id, 'aria-selected': String(c.id === current), 'aria-controls': 'paperGrid' },
        c.en, c.id !== 'all' ? h('span', { class: 'bn' }, `(${c.bn})`) : null, h('span', { class: 'count' }, count));
    }));

    const scrollToDir = () => {
      const dir = $('#directory');
      if (dir && Math.abs(dir.getBoundingClientRect().top) > 80) dir.scrollIntoView({ behavior: 'smooth' });
    };
    const selectCat = (id, scroll = true) => {
      current = catMap[id] ? id : 'all';
      if (search && search.value) search.value = '';
      const url = location.pathname + (current === 'all' ? '' : `#cat=${current}`);
      if (location.pathname + location.hash !== url) history.replaceState(null, '', url);
      render();
      $(`.tab[data-cat="${current}"]`, tabs)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      if (scroll) scrollToDir();
    };

    tabs.addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) selectCat(b.dataset.cat); });
    tabs.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const all = $$('.tab', tabs);
      const next = all[(all.indexOf(document.activeElement) + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length];
      next.focus(); selectCat(next.dataset.cat, false);
    });
    // "See all" links inside sections and mega-menu links on this page
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#cat="]');
      if (!a) return;
      e.preventDefault();
      selectCat(a.getAttribute('href').slice(5));
    });
    window.addEventListener('hashchange', () => { const c = fromHash(); if (catMap[c] && c !== current) selectCat(c); });

    // ---- Render ----
    function render() {
      const q = (search?.value || '').trim();
      const ql = q.toLowerCase();
      $$('.tab', tabs).forEach((t) => t.setAttribute('aria-selected', String(!q && t.dataset.cat === current)));

      if (q) {
        // Search mode: flat result grid across all (or the current) category.
        const list = papers.filter((p) => (current === 'all' || p.category === current) && p._q.includes(ql));
        const nodes = [];
        list.forEach((p, i) => {
          nodes.push(paperCard(p, { cat: catMap[p.category], div: divMap[p.division], q, showTag: true }));
          if ((i + 1) % AD_EVERY === 0 && i + 1 < list.length) {
            const ad = inFeedAd(`s${i}`);
            if (ad) nodes.push(ad);
          }
        });
        if (!list.length) nodes.push(h('div', { class: 'empty' }, `"${q}" — কোনো পত্রিকা পাওয়া যায়নি। No newspaper matched your search.`));
        resultsGrid.replaceChildren(...nodes);
        resultsGrid.hidden = false;
        sectionNodes.forEach((n) => { n.hidden = true; });
        if (status) status.textContent = `${toBn(list.length)}টি ফলাফল · ${list.length} results for "${q}"`;
        return;
      }

      resultsGrid.hidden = true;
      resultsGrid.replaceChildren();
      for (const n of sectionNodes) {
        if (n.classList.contains('between-sec')) { n.hidden = current !== 'all'; continue; }
        const id = n.id.slice(4);
        n.hidden = current !== 'all' && id !== current;
      }
      // A single category view shows every paper in it.
      Object.keys(sections).forEach((id) => { if (current !== 'all') setExpanded(id, id === current); });
      if (current === 'all') Object.keys(sections).forEach((id) => setExpanded(id, false));

      if (status) {
        const n = current === 'all' ? papers.length : sections[current]?.count || 0;
        status.textContent = `${toBn(n)}টি পত্রিকা · ${n} sites in ${catMap[current].en}`;
      }
    }

    // Support ?q= coming from the search box on other pages.
    const preset = new URLSearchParams(location.search).get('q');
    if (preset && search) search.value = preset.slice(0, 60);

    let t;
    search?.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 80); });
    search?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { search.value = ''; render(); search.blur(); }
      if (e.key === 'Enter') { e.preventDefault(); scrollToDir(); }
    });
    render();
    if (fromHash() || preset) requestAnimationFrame(() => $('#directory')?.scrollIntoView());
  }

  /* ---------------- Search shortcut ("/") ---------------- */
  function initSearchShortcut() {
    const s = $('#searchInput');
    if (!s) return;
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !/input|textarea/i.test(document.activeElement?.tagName)) { e.preventDefault(); s.focus(); }
    });
  }

  /* ---------------- Mobile anchor ad ---------------- */
  function initAnchor() {
    const anchor = $('#adAnchor');
    if (!anchor) return;
    let closed = false;
    try { closed = sessionStorage.getItem('anchorClosed') === '1'; } catch { /* ignore */ }
    if (closed) { anchor.hidden = true; return; }
    anchor.hidden = false;
    document.body.classList.add('has-anchor');
    $('#adAnchorClose')?.addEventListener('click', () => {
      anchor.hidden = true;
      document.body.classList.remove('has-anchor');
      try { sessionStorage.setItem('anchorClosed', '1'); } catch { /* ignore */ }
    });
  }

  /* ---------------- Back to top + footer year ---------------- */
  function initMisc() {
    const btn = $('#toTop');
    if (btn) {
      addEventListener('scroll', () => btn.classList.toggle('show', scrollY > 800), { passive: true });
      btn.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
    }
    $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  }

  /* ---------------- Boot ---------------- */
  initTheme();
  initReader();
  initDate();
  initMisc();
  initAnchor();
  initSearchShortcut();
  initNav();
  initStrip();
  loadNews();
  initSports();
  initDirectory();
  if ($('#liveGrid')) setInterval(() => { if (!document.hidden) { loadNews(); loadSports(); } }, 6e5);
})();
