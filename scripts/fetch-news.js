#!/usr/bin/env node
/**
 * Top News by Khoozo — RSS fetcher
 * ---------------------------------
 * Fetches Google News Bangladesh RSS (Bangla + English), parses the XML with
 * plain regex (no dependencies), merges, de-duplicates, sorts by date and
 * writes the newest items to data/news.json.
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
const OUT_FILE = path.join(__dirname, '..', 'data', 'news.json');
const MAX_ITEMS = 15;
const TIMEOUT_MS = 15000;

const FEEDS = [
  { lang: 'bn', url: 'https://news.google.com/rss?hl=bn&gl=BD&ceid=BD:bn' },
  { lang: 'en', url: 'https://news.google.com/rss?hl=en-BD&gl=BD&ceid=BD:en' },
];

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

async function fetchFeed({ url, lang }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TopNewsBot/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseItems(xml, lang);
    console.log(`✓ ${lang}: ${items.length} items`);
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

async function main() {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const lists = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    console.warn(`✗ ${FEEDS[i].lang}: ${r.reason?.message || r.reason}`);
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
    console.warn('No items fetched — keeping existing data/news.json');
    return;
  }

  const payload = { updated: new Date().toISOString(), count: items.length, items };
  const next = JSON.stringify(payload, null, 2) + '\n';

  // Skip writing when only the timestamp would change (keeps git history clean).
  try {
    const prev = JSON.parse(await readFile(OUT_FILE, 'utf8'));
    if (JSON.stringify(prev.items) === JSON.stringify(items)) {
      console.log('No new headlines — file unchanged.');
      return;
    }
  } catch { /* first run or invalid file: write it */ }

  await writeFile(OUT_FILE, next, 'utf8');
  console.log(`Saved ${items.length} items → data/news.json`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
