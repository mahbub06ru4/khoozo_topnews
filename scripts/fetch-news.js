#!/usr/bin/env node
/**
 * Top News by Khoozo — RSS fetcher
 * ---------------------------------
 * Fetches Google News Bangladesh RSS (Bangla + English), parses the XML with
 * plain regex (no dependencies), merges, de-duplicates, sorts by date and
 * writes the newest items to data/news.json. Cricket and football headlines
 * (Google News search feeds) are written the same way to data/sports.json.
 *
 * Runs on Node 20+ (uses the built-in global fetch). No `npm install` needed.
 *   node scripts/fetch-news.js
 *
 * If every feed fails, the existing data/news.json is left untouched so the
 * site never shows an empty live section.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const MAX_ITEMS = 15;
const MAX_SPORTS = 24;
const TIMEOUT_MS = 15000;

const FEEDS = [
  { lang: 'bn', url: 'https://news.google.com/rss?hl=bn&gl=BD&ceid=BD:bn' },
  { lang: 'en', url: 'https://news.google.com/rss?hl=en-BD&gl=BD&ceid=BD:en' },
];

// Sports: Google News search feeds for cricket and football (last 24 hours).
const gsearch = (q, bn) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:1d`)}&${bn ? 'hl=bn&gl=BD&ceid=BD:bn' : 'hl=en-BD&gl=BD&ceid=BD:en'}`;
const EN_CRICKET_SITES = ['espncricinfo.com', 'cricbuzz.com', 'icc-cricket.com', 'bbc.com', 'thedailystar.net', 'dhakatribune.com', 'tbsnews.net'];
const EN_FOOTBALL_SITES = ['bbc.com', 'espn.com', 'goal.com', 'skysports.com', 'theguardian.com', 'reuters.com', 'thedailystar.net', 'dhakatribune.com'];
const sites = (list) => list.map((s) => `site:${s}`).join(' OR ');
const SPORTS_FEEDS = [
  { lang: 'bn', sport: 'cricket', url: gsearch('ক্রিকেট', true) },
  { lang: 'bn', sport: 'football', url: gsearch('ফুটবল', true) },
  { lang: 'en', sport: 'cricket', url: gsearch(`cricket (${sites(EN_CRICKET_SITES)})`, false) },
  { lang: 'en', sport: 'football', url: gsearch(`football (${sites(EN_FOOTBALL_SITES)})`, false) },
];
// Open English searches attract pirated-stream spam, so those two feeds are limited
// to the publishers above and every sports headline is checked against this filter.
const SPORTS_SPAM = /stream|free\b|watch online|\btv\b.*\blive\b|[\u{1D400}-\u{1D7FF}Ａ-ｚ]/iu;
// "Football" on US sites means the NFL / college game, which this section is not about.
const US_FOOTBALL = /\bNFL\b|quarterback|touchdown|betting line|Sweet 16|\bbowl\b|Lions'|Patriots|Cowboys|Packers|Seahawks|Gamecocks|Volunteers/i;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(str = '') {
  return str.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

function stripCdata(str = '') {
  return str.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeEntities(stripCdata(m[1])).trim() : '';
}

function parseItems(xml, lang) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[1];
    let title = tag(block, 'title');
    const link = tag(block, 'link');
    const source = tag(block, 'source');
    const pubDate = tag(block, 'pubDate');

    // Google News titles look like "Headline - Publisher"; drop the suffix.
    if (source && title.endsWith(` - ${source}`)) {
      title = title.slice(0, -(source.length + 3)).trim();
    }
    const date = new Date(pubDate);
    if (!title || !/^https?:\/\//i.test(link) || Number.isNaN(date.getTime())) continue;

    items.push({
      title,
      link,
      source: source || 'Google News',
      pubDate: date.toISOString(),
      lang,
    });
  }
  return items;
}

async function fetchFeed({ url, lang, sport }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TopNewsBot/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    let items = parseItems(xml, lang);
    if (sport) {
      items = items.filter((it) => !SPORTS_SPAM.test(it.title) && !(sport === 'football' && US_FOOTBALL.test(it.title)));
      // Search results are noisy: re-tag a story whose headline names only the other sport.
      const CRICKET = /cricket|ক্রিকেট/i;
      const FOOTBALL = /football|soccer|ফুটবল/i;
      for (const it of items) {
        const c = CRICKET.test(it.title);
        const f = FOOTBALL.test(it.title);
        it.sport = c && !f ? 'cricket' : f && !c ? 'football' : sport;
      }
    }
    console.log(`✓ ${sport ? `${sport} ` : ''}${lang}: ${items.length} items`);
    return items;
  } finally {
    clearTimeout(timer);
  }
}

/** Interleave Bangla and English so both languages appear in the top list. */
function interleave(lists) {
  const out = [];
  const max = Math.max(...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

/** Fetch a set of feeds and write the merged, de-duplicated list to data/<file>. */
async function build(FEEDS, file, MAX_ITEMS) {
  const OUT_FILE = path.join(DATA_DIR, file);
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const lists = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    console.warn(`✗ ${FEEDS[i].sport || ''} ${FEEDS[i].lang}: ${r.reason?.message || r.reason}`);
    return [];
  });

  const sorted = lists.map((l) => l.sort((a, b) => b.pubDate.localeCompare(a.pubDate)));
  const seen = new Set();
  const items = interleave(sorted)
    .filter((it) => {
      const key = it.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_ITEMS);

  if (items.length === 0) {
    console.warn(`No items fetched — keeping existing data/${file}`);
    return;
  }

  const payload = { updated: new Date().toISOString(), count: items.length, items };
  const next = JSON.stringify(payload, null, 2) + '\n';

  // Skip writing when only the timestamp would change (keeps git history clean).
  try {
    const prev = JSON.parse(await readFile(OUT_FILE, 'utf8'));
    if (JSON.stringify(prev.items) === JSON.stringify(items)) {
      console.log(`No new headlines — data/${file} unchanged.`);
      return;
    }
  } catch { /* first run or invalid file: write it */ }

  await writeFile(OUT_FILE, next, 'utf8');
  console.log(`Saved ${items.length} items → data/${file}`);
}

async function main() {
  await build(FEEDS, 'news.json', MAX_ITEMS);
  await build(SPORTS_FEEDS, 'sports.json', MAX_SPORTS);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
