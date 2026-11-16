#!/usr/bin/env node
/**
 * Top News by Khoozo — outbound link checker
 * ------------------------------------------
 * Requests every URL in data/newspapers.json and reports the ones that fail,
 * so dead links are found before a reader (or an ad reviewer) clicks one.
 *
 *   node scripts/check-links.js
 *
 * Nothing is modified: fix anything reported in data/newspapers.json by hand.
 * A site that blocks automated requests may answer 403 while working fine in a
 * browser, so treat the report as a list to look at, not a list to delete.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIMEOUT_MS = 20000;
const CONCURRENCY = 8;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

async function check(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // Some publishers reject HEAD, so fall back to a GET that is abandoned early.
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA } });
    if (res.status === 405 || res.status === 403 || res.status === 501) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA } });
    }
    return { status: res.status, final: res.url };
  } catch (err) {
    return { status: 0, error: err.cause?.code || err.name || String(err.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const data = JSON.parse(await readFile(path.join(ROOT, 'data', 'newspapers.json'), 'utf8'));
  const list = data.newspapers;
  const results = [];
  let i = 0;

  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (i < list.length) {
      const n = list[i++];
      const r = await check(n.url);
      results.push({ ...n, ...r });
      process.stdout.write(r.status >= 200 && r.status < 400 ? '.' : 'x');
    }
  }));
  process.stdout.write('\n\n');

  const bad = results.filter((r) => !(r.status >= 200 && r.status < 400));
  const moved = results.filter((r) => r.final && new URL(r.final).host.replace(/^www\./, '') !== new URL(r.url).host.replace(/^www\./, ''));

  if (moved.length) {
    console.log(`Redirected to a different host (${moved.length}) — check these are intended:`);
    for (const m of moved) console.log(`  ${m.name_en}\n    ${m.url}\n    → ${m.final}`);
    console.log('');
  }
  if (!bad.length) {
    console.log(`All ${results.length} links responded successfully.`);
    return;
  }
  console.log(`Failed (${bad.length} of ${results.length}):`);
  for (const b of bad) console.log(`  [${b.status || b.error}] ${b.name_en} (${b.category}) — ${b.url}`);
  process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
