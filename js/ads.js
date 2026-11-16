/* =========================================================================
   Top News by Khoozo — ad manager
   -------------------------------------------------------------------------
   Fills every element with [data-ad-type] using whatever network is named in
   js/ads-config.js. Edit the config, never this file.

   Exposes window.KhoozoAds:
     fill(el)        — fill one slot element
     fillAll(root)   — fill every unfilled slot inside root (default: document)
   js/app.js calls fillAll() on boot and fill() for each in-feed slot it
   creates, so new slots are filled as they appear.
   ========================================================================= */
(() => {
  'use strict';

  const CFG = window.ADS_CONFIG || {};
  // ?ads=<network> previews another network in your own browser without editing
  // the config or affecting anyone else. ?ads=off hides the slots.
  const PREVIEW = new URLSearchParams(location.search).get('ads');
  const NET = (PREVIEW === 'off' ? 'none' : PREVIEW) || CFG.network || 'none';
  const MOBILE = matchMedia('(max-width: 767px)');

  /** Slots are marked as handled so a slot is never filled twice. */
  const done = (el) => el.dataset.adFilled === '1';
  const mark = (el) => { el.dataset.adFilled = '1'; };

  /** Insert trusted HTML and run any <script> it contains (scripts added via
      innerHTML never execute, so each one is recreated). */
  function injectHtml(el, html) {
    el.innerHTML = html;
    for (const old of [...el.querySelectorAll('script')]) {
      const s = document.createElement('script');
      for (const { name, value } of old.attributes) s.setAttribute(name, value);
      s.textContent = old.textContent;
      old.replaceWith(s);
    }
  }

  const loadOnce = (src, id) => {
    // Skip when the tag is already in the page — the AdSense snippet is also
    // hard-coded in each page's <head> so it works without JavaScript first.
    if (!src || document.getElementById(id)) return;
    const file = src.split('?')[0];
    if (document.querySelector(`script[src^="${file}"]`)) return;
    const s = document.createElement('script');
    s.id = id;
    s.async = true;
    s.src = src;
    s.crossOrigin = 'anonymous';
    document.head.append(s);
  };

  /* ---------------- Networks ---------------- */

  function adsense(el, type) {
    const { client, slots = {} } = CFG.adsense || {};
    const slot = slots[type];
    if (!client || !slot) return false;
    loadOnce(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`, 'adsense-lib');
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.dataset.adClient = client;
    ins.dataset.adSlot = slot;
    if (type === 'infeed') { ins.dataset.adFormat = 'fluid'; ins.dataset.fullWidthResponsive = 'true'; }
    else { ins.dataset.adFormat = 'horizontal'; ins.dataset.fullWidthResponsive = 'true'; }
    el.replaceChildren(ins);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { return false; }
    return true;
  }

  function adsterra(el, type) {
    const cfg = CFG.adsterra || {};
    // The leaderboard has an optional separate mobile unit (320x100).
    const unit = (type === 'leaderboard' && MOBILE.matches && cfg.leaderboardMobile?.key)
      ? cfg.leaderboardMobile
      : cfg[type];
    if (!unit?.key) return false;
    // Adsterra's snippet reads a global `atOptions` when its script loads, so two
    // units on one page overwrite each other. One iframe per unit keeps them apart.
    const opts = { key: unit.key, format: 'iframe', height: unit.height, width: unit.width, params: {} };
    const frame = document.createElement('iframe');
    frame.width = unit.width;
    frame.height = unit.height;
    frame.scrolling = 'no';
    frame.loading = 'lazy';
    frame.title = 'Advertisement';
    frame.style.cssText = 'border:0;display:block;max-width:100%';
    frame.srcdoc = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden}</style>`
      + `<script>window.atOptions=${JSON.stringify(opts)};<\/script>`
      + `<script src="//www.highperformanceformat.com/${encodeURIComponent(unit.key)}/invoke.js"><\/script>`;
    el.replaceChildren(frame);
    return true;
  }

  function ezoic(el, type) {
    const id = (CFG.ezoic || {})[type];
    if (!id) return false;
    const ph = document.createElement('div');
    ph.id = `ezoic-pub-ad-placeholder-${id}`;
    el.replaceChildren(ph);
    try {
      window.ezstandalone = window.ezstandalone || {};
      ezstandalone.cmd = ezstandalone.cmd || [];
      ezstandalone.cmd.push(() => ezstandalone.showAds(id));
    } catch { /* the Ezoic script is missing from <head>; the div stays empty */ }
    return true;
  }

  function custom(el, type) {
    const html = (CFG.custom || {})[type];
    if (!html) return false;
    injectHtml(el, html);
    return true;
  }

  /* ---------------- House ads (fallback) ---------------- */

  function house(el, type) {
    const list = CFG.house || [];
    if (!list.length) return false;
    const ad = list[Math.floor(Math.random() * list.length)];
    const a = document.createElement('a');
    a.className = 'house-ad';
    a.href = ad.url || '#';
    a.style.setProperty('--c', ad.color || '#0a7a57');
    if (/^https?:/i.test(a.href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }

    const add = (cls, text, tag = 'span') => {
      if (!text) return;
      const n = document.createElement(tag);
      n.className = cls;
      n.textContent = text;          // textContent: config text can't inject HTML
      if (/[ঀ-৿]/.test(text)) n.lang = 'bn';
      a.append(n);
    };
    add('house-tag', ad.tag);
    add('house-title', ad.title, 'strong');
    if (type !== 'anchor') add('house-text', ad.text);
    add('house-cta', ad.cta);

    el.classList.add('is-house');
    el.replaceChildren(a);
    return true;
  }

  /* ---------------- Public API ---------------- */

  const RENDER = { adsense, adsterra, ezoic, custom, house };

  /** Fills one slot. Returns false when the slot should not exist at all, so a
      caller building the page can drop it instead of leaving an empty box. */
  function fill(el) {
    if (!el) return false;
    if (done(el)) return true;
    mark(el);
    const type = el.dataset.adType;
    if (!type || NET === 'none') { el.remove(); return false; }
    // Fall back to a house ad whenever the chosen network has nothing for this slot.
    const ok = (RENDER[NET] || (() => false))(el, type) || house(el, type);
    if (!ok) el.remove();
    return ok;
  }

  const fillAll = (root = document) => root.querySelectorAll('[data-ad-type]').forEach(fill);

  // `enabled` is false when nothing would ever be shown, so js/app.js can skip
  // creating in-feed slots entirely rather than appending empty ones.
  const enabled = NET !== 'none' && (NET === 'house' ? !!(CFG.house || []).length : true);

  window.KhoozoAds = { fill, fillAll, enabled };

  // Site-wide tags, loaded once and independent of the boxes above.
  // AdSense Auto ads: Google places units itself; the boxes keep their own
  // content (a house ad) until fixed ad-unit IDs are added to the config.
  if (NET === 'adsense' && CFG.adsense?.autoAds && CFG.adsense.client) {
    loadOnce(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(CFG.adsense.client)}`, 'adsense-lib');
  }
  if (NET === 'monetag') loadOnce((CFG.monetag || {}).tag, 'monetag-tag');

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => fillAll());
  else fillAll();
})();
