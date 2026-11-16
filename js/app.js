/* =========================================================================
   Top News by Khoozo — app.js (vanilla, zero dependencies)
   - Dark/light theme with persistence
   - Live Bangla (Gregorian + Bangabda) / English date
   - Breaking ticker + live headlines from data/news.json
   - Newspaper directory from data/newspapers.json with category tabs,
     instant search, and in-feed ad slots every 12 cards
   - Sticky mobile anchor ad with close button
   ========================================================================= */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
  const toBn = (v) => String(v).replace(/\d/g, (d) => BN_DIGITS[d]);

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
  const ICON_EXT = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';

  /* ---------------- Theme ---------------- */
  function initTheme() {
    const root = document.documentElement;
    const btn = $('#themeToggle');
    const apply = (t) => {
      root.dataset.theme = t;
      if (btn) btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.content = t === 'dark' ? '#0d1015' : '#ffffff';
    };
    apply(root.dataset.theme || 'light');
    btn?.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(next);
      store.set('theme', next);
    });
    // Follow OS changes only if the user never chose explicitly.
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', (e) => {
      if (!store.get('theme')) apply(e.matches ? 'dark' : 'light');
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
      // Use Dhaka time so visitors abroad still see the BD date.
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

  /* ---------------- Live news ---------------- */
  async function loadNews() {
    const grid = $('#liveGrid');
    const ticker = $('#tickerMove');
    if (!grid && !ticker) return;
    try {
      // Cache-bust every 5 minutes so GitHub Pages' CDN copy refreshes regularly.
      const res = await fetch(`data/news.json?v=${Math.floor(Date.now() / 3e5)}`);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      const items = (data.items || []).filter((i) => i && i.title && i.link);
      if (!items.length) throw new Error('empty');

      if (ticker) {
        const links = items.map((it) => h('a', { href: safeUrl(it.link), target: '_blank', rel: 'noopener noreferrer', lang: it.lang }, it.title));
        // Duplicate the list for a seamless -50% loop; the copy is hidden from AT.
        const copy = links.map((a) => { const c = a.cloneNode(true); c.tabIndex = -1; c.setAttribute('aria-hidden', 'true'); return c; });
        ticker.replaceChildren(...links, ...copy);
        ticker.style.setProperty('--ticker-dur', `${Math.max(40, items.length * 7)}s`);
      }

      if (grid) {
        grid.replaceChildren(...items.slice(0, 10).map((it) => h('li', {},
          h('a', { class: 'live-card', href: safeUrl(it.link), target: '_blank', rel: 'noopener noreferrer' },
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
      ticker?.replaceChildren(h('a', { href: 'https://news.google.com/?hl=bn&gl=BD&ceid=BD:bn', target: '_blank', rel: 'noopener noreferrer' }, 'সর্বশেষ খবর দেখুন Google News-এ'));
    }
  }

  /* ---------------- Newspaper directory ---------------- */
  const AD_EVERY = 12;
  const PALETTE = ['#d71920', '#0b6e4f', '#1d4ed8', '#7c3aed', '#c2410c', '#0e7490', '#be185d', '#4d7c0f'];

  function logoFor(p) {
    const host = hostOf(p.url);
    const wrap = h('span', { class: 'paper-logo' });
    const fallback = () => {
      const letter = (p.name_bn || p.name_en || '?').trim().charAt(0);
      const color = PALETTE[[...host].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
      wrap.replaceChildren(h('span', { class: 'initial', style: `background:${color}`, 'aria-hidden': 'true' }, letter));
    };
    if (!host) { fallback(); return wrap; }
    const img = h('img', {
      src: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`,
      alt: '', width: 32, height: 32, loading: 'lazy', decoding: 'async',
    });
    img.addEventListener('error', fallback, { once: true });
    // Google returns a 16px generic globe when it has no icon — treat as missing.
    img.addEventListener('load', () => { if (img.naturalWidth && img.naturalWidth < 20) fallback(); }, { once: true });
    wrap.append(img);
    return wrap;
  }

  function highlight(text, q) {
    if (!q) return text;
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return text;
    const frag = document.createDocumentFragment();
    frag.append(text.slice(0, i), h('mark', {}, text.slice(i, i + q.length)), text.slice(i + q.length));
    return frag;
  }

  function inFeedAd(n) {
    // AdSense in-feed slot. Replace the placeholder text with your <ins class="adsbygoogle" ...> unit.
    return h('div', { class: 'ad-slot ad-infeed', 'data-ad-slot': `infeed-${n}`, role: 'complementary', 'aria-label': 'Advertisement' }, 'In-Feed Ad');
  }

  async function initDirectory() {
    const grid = $('#paperGrid');
    const tabs = $('#catTabs');
    const search = $('#searchInput');
    const status = $('#dirStatus');
    if (!grid) return;

    let data;
    try {
      const res = await fetch('data/newspapers.json');
      data = await res.json();
    } catch (err) {
      grid.replaceChildren(h('p', { class: 'empty' }, 'তালিকা লোড করা যায়নি। Please refresh the page.'));
      return;
    }
    const cats = data.categories;
    const catMap = Object.fromEntries(cats.map((c) => [c.id, c]));
    const papers = data.newspapers.map((p) => ({ ...p, _q: `${p.name_bn} ${p.name_en} ${hostOf(p.url)}`.toLowerCase() }));

    const fromHash = () => (location.hash.match(/cat=([a-z]+)/) || [])[1];
    let current = catMap[fromHash()] ? fromHash() : 'all';

    // Tabs
    tabs.replaceChildren(...cats.map((c) => {
      const count = c.id === 'all' ? papers.length : papers.filter((p) => p.category === c.id).length;
      const b = h('button', { class: 'tab', role: 'tab', type: 'button', 'data-cat': c.id, 'aria-selected': String(c.id === current), 'aria-controls': 'paperGrid' },
        c.en, c.id !== 'all' ? h('span', { class: 'bn' }, `(${c.bn})`) : null, h('span', { class: 'count' }, count));
      return b;
    }));

    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('.tab');
      if (!b) return;
      current = b.dataset.cat;
      history.replaceState(null, '', current === 'all' ? location.pathname : `#cat=${current}`);
      render();
      b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      const dir = $('#directory');
      if (dir && dir.getBoundingClientRect().top < 0) dir.scrollIntoView({ behavior: 'smooth' });
    });

    // Keyboard navigation for tabs (arrow keys)
    tabs.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const all = [...tabs.querySelectorAll('.tab')];
      const i = all.indexOf(document.activeElement);
      const next = all[(i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length];
      next.focus(); next.click();
    });

    function render() {
      const q = (search?.value || '').trim();
      const ql = q.toLowerCase();
      tabs.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.cat === current)));

      const list = papers.filter((p) => (current === 'all' || p.category === current) && (!ql || p._q.includes(ql)));
      const nodes = [];
      list.forEach((p, i) => {
        const cat = catMap[p.category];
        nodes.push(h('a', { class: 'paper', href: safeUrl(p.url), target: '_blank', rel: 'noopener noreferrer', title: `${p.name_en} — ${hostOf(p.url)}` },
          logoFor(p),
          h('span', { class: 'paper-bn', lang: 'bn' }, highlight(p.name_bn, q)),
          h('span', { class: 'paper-en' }, highlight(p.name_en, q)),
          cat ? h('span', { class: 'paper-tag', lang: 'bn' }, cat.bn) : null,
          h('span', { class: 'paper-ext', html: ICON_EXT })));
        if ((i + 1) % AD_EVERY === 0 && i + 1 < list.length) nodes.push(inFeedAd((i + 1) / AD_EVERY));
      });

      if (!list.length) {
        nodes.push(h('div', { class: 'empty' }, `"${q}" — কোনো পত্রিকা পাওয়া যায়নি। No newspaper matched your search.`));
      }
      grid.replaceChildren(...nodes);
      if (status) {
        const label = catMap[current];
        status.textContent = `${toBn(list.length)}টি পত্রিকা · ${list.length} sites in ${label.en}${q ? ` matching "${q}"` : ''}`;
      }
    }

    // Support ?q= coming from the search box on other pages.
    const preset = new URLSearchParams(location.search).get('q');
    if (preset && search) search.value = preset.slice(0, 60);

    let t;
    search?.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 80); });
    search?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { search.value = ''; render(); search.blur(); }
      if (e.key === 'Enter') { e.preventDefault(); $('#directory')?.scrollIntoView({ behavior: 'smooth' }); }
    });
    window.addEventListener('hashchange', () => { const c = fromHash(); if (catMap[c]) { current = c; render(); } });
    render();
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
      const onScroll = () => btn.classList.toggle('show', scrollY > 800);
      addEventListener('scroll', onScroll, { passive: true });
      btn.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
    }
    document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  }

  /* ---------------- Boot ---------------- */
  initTheme();
  initDate();
  initMisc();
  initAnchor();
  initSearchShortcut();
  loadNews();
  initDirectory();
  // Refresh live headlines every 10 minutes while the tab is open.
  if ($('#liveGrid')) setInterval(() => { if (!document.hidden) loadNews(); }, 6e5);
})();
