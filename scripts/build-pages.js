#!/usr/bin/env node
/**
 * Top News by Khoozo — category page builder
 * ------------------------------------------
 * Turns data/pages.json (the editorial writing) + data/newspapers.json (the
 * links) into one static HTML page per category, e.g. bangla-newspapers.html.
 *
 *   node scripts/build-pages.js
 *
 * The page shell (head, header, nav, footer) is taken from about.html so the
 * generated pages can never drift from the hand-written ones — change the
 * header there and rebuild.
 *
 * Everything is emitted as static HTML, including the newspaper cards, so
 * search engines and ad reviewers see the content without running JavaScript.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://topnews.khoozo.com';
const p = (...f) => path.join(ROOT, ...f);

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const isBn = (s = '') => /[ঀ-৿]/.test(s);

const PALETTE = ['#d71920', '#0b6e4f', '#1d4ed8', '#7c3aed', '#c2410c', '#0e7490', '#be185d', '#4d7c0f'];
const colorFor = (n) => n.color || PALETTE[[...hostOf(n.url)].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

/* ---------------- Pieces of a page ---------------- */

/** One newspaper card, matching the markup js/app.js builds on the homepage. */
function card(n, divisions) {
  const c = colorFor(n);
  const len = [...n.name_bn].length;
  const wm = `wm${len > 14 ? ' wm-sm' : len > 9 ? ' wm-md' : ''}`;
  const div = divisions[n.division];
  // onerror keeps a missing favicon from showing a broken-image icon.
  const fav = n.logo
    ? `<img class="logo-img" src="${esc(n.logo)}" alt="${esc(n.name_en)}" loading="lazy" decoding="async" height="48" onerror="this.remove()">`
    : `<img class="fav" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(n.url))}&amp;sz=64" alt="" width="28" height="28" loading="lazy" decoding="async" onerror="this.remove()">`;
  return `          <a class="paper" style="--c:${esc(c)}" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer" title="${esc(n.name_en)} — ${esc(hostOf(n.url))}">
            <span class="paper-logo" style="--c:${esc(c)}">${fav}${n.logo ? '' : `<span class="${wm}" lang="bn">${esc(n.name_bn)}</span>`}</span>
            <span class="paper-en">${esc(n.name_en)}</span>${div ? `\n            <span class="paper-tag" lang="bn">${esc(div.bn)} বিভাগ</span>` : ''}
          </a>`;
}

const prose = (sections) => sections.map((s) => {
  const bn = s.lang === 'bn';
  return `        <h2${bn ? ' lang="bn" class="bn"' : ''}>${esc(s.h2)}</h2>\n`
    + s.p.map((t) => `        <p${isBn(t) ? ' lang="bn" class="bn"' : ''}>${esc(t)}</p>`).join('\n');
}).join('\n');

const faqHtml = (faq) => faq.map((f) => `        <details class="acc">
          <summary${isBn(f.q) ? ' lang="bn" class="bn"' : ''}>${esc(f.q)}</summary>
          <div><p${isBn(f.a) ? ' lang="bn" class="bn"' : ''}>${esc(f.a)}</p></div>
        </details>`).join('\n');

/** Links to every other category page — the internal linking between guides. */
const siblings = (pages, current) => Object.entries(pages)
  .filter(([id]) => id !== current)
  .map(([, v]) => `          <li><a href="${v.slug}.html">${esc(v.h1)}</a></li>`)
  .join('\n');

function jsonLd(page, cat, count, faq) {
  const url = `${SITE}/${page.slug}.html`;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#page`,
        url,
        name: page.title,
        description: page.meta,
        inLanguage: ['bn-BD', 'en'],
        isPartOf: { '@id': `${SITE}/#website` },
        about: { '@type': 'Thing', name: cat.title_en || cat.en },
        mainEntity: {
          '@type': 'ItemList',
          name: page.h1,
          numberOfItems: count,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: page.h1, item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }, null, 2);
}

/* ---------------- Page assembly ---------------- */

function buildMain(page, cat, papers, divisions, pages, id) {
  const count = papers.length;
  return `<main id="main">
    <div class="container">
      <div class="ad-slot ad-leaderboard" data-ad-type="leaderboard" role="complementary" aria-label="Advertisement"></div>

      <nav class="crumbs" aria-label="Breadcrumb">
        <a href="./">Home</a><span aria-hidden="true">›</span><span aria-current="page">${esc(page.h1)}</span>
      </nav>

      <article class="page prose">
        <h1>${esc(page.h1)}</h1>
        <p class="lead">${esc(page.lead)}</p>
      </article>

      <section class="section" aria-labelledby="listTitle">
        <div class="section-head">
          <h2 class="section-title" id="listTitle"><span class="bar" aria-hidden="true"></span><span><span class="bn" lang="bn">${esc(cat.bn)}</span> · ${count} sites</span></h2>
          <p class="section-sub"><a class="sec-link" href="./#cat=${esc(id)}">Open in the full directory →</a></p>
        </div>
        <div class="paper-grid">
${papers.map((n) => card(n, divisions)).join('\n')}
        </div>
      </section>

      <div class="ad-slot ad-infeed" data-ad-type="infeed" role="complementary" aria-label="Advertisement"></div>

      <article class="page prose">
${prose(page.sections)}
      </article>

      <section class="section" aria-labelledby="faqTitle">
        <div class="section-head"><h2 class="section-title" id="faqTitle"><span class="bar" aria-hidden="true"></span>FAQ</h2></div>
        <div class="faq">
${faqHtml(page.faq)}
        </div>
      </section>

      <nav class="section guide-links" aria-labelledby="moreTitle">
        <h2 class="section-title" id="moreTitle"><span class="bar" aria-hidden="true"></span>More category guides</h2>
        <ul>
${siblings(pages, id)}
        </ul>
      </nav>
    </div>
  </main>`;
}

/** Swap the head metadata of the about.html shell for this page's own. */
function buildHead(head, page) {
  const url = `${SITE}/${page.slug}.html`;
  let out = head
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(page.title)} | Top News by Khoozo</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(page.meta)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`)
    // about.html marks its own nav link as current; a generated page must not.
    .replace(/ aria-current="page"/g, '');
  const og = `  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Top News by Khoozo">
  <meta property="og:title" content="${esc(page.title)}">
  <meta property="og:description" content="${esc(page.meta)}">
  <meta property="og:url" content="${url}">
  <meta property="og:locale" content="bn_BD">
  <meta name="twitter:card" content="summary">
`;
  return out.replace(/(<link rel="canonical"[^>]*>\n)/, `$1${og}`);
}

async function main() {
  const [pagesRaw, papersRaw, shell] = await Promise.all([
    readFile(p('data', 'pages.json'), 'utf8'),
    readFile(p('data', 'newspapers.json'), 'utf8'),
    readFile(p('about.html'), 'utf8'),
  ]);
  const { pages } = JSON.parse(pagesRaw);
  const data = JSON.parse(papersRaw);
  const divisions = Object.fromEntries((data.divisions || []).map((d) => [d.id, d]));
  const catMap = Object.fromEntries(data.categories.map((c) => [c.id, c]));

  const open = shell.indexOf('<main');
  const close = shell.indexOf('</main>');
  if (open < 0 || close < 0) throw new Error('about.html has no <main> block to use as a template');
  const head = shell.slice(0, open);
  const tail = shell.slice(close + '</main>'.length);

  const written = [];
  for (const [id, page] of Object.entries(pages)) {
    const cat = catMap[id];
    if (!cat) { console.warn(`! no category "${id}" in newspapers.json — skipped`); continue; }
    const papers = data.newspapers.filter((n) => n.category === id);
    if (!papers.length) { console.warn(`! category "${id}" has no newspapers — skipped`); continue; }

    const ld = `  <script type="application/ld+json">\n${jsonLd(page, cat, papers.length, page.faq)}\n  </script>\n`;
    const html = buildHead(head, page).replace(/(<\/head>)/, `${ld}$1`)
      + buildMain(page, cat, papers, divisions, pages, id)
      + tail;
    await writeFile(p(`${page.slug}.html`), html, 'utf8');
    written.push({ slug: page.slug, count: papers.length });
    console.log(`✓ ${page.slug}.html — ${papers.length} sites`);

    // Keep the slug on the category so js/app.js can link the menu to this page.
    cat.page = `${page.slug}.html`;
  }

  await writeFile(p('data', 'newspapers.json'), JSON.stringify(data, null, 2) + '\n', 'utf8');

  // Sitemap: the static pages plus every generated guide.
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE}/`, pri: '1.0', freq: 'hourly' },
    ...written.map((w) => ({ loc: `${SITE}/${w.slug}.html`, pri: '0.8', freq: 'weekly' })),
    ...['about', 'contact', 'privacy', 'disclaimer'].map((f) => ({ loc: `${SITE}/${f}.html`, pri: '0.3', freq: 'yearly' })),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.pri}</priority>\n  </url>`).join('\n')
    + `\n</urlset>\n`;
  await writeFile(p('sitemap.xml'), sitemap, 'utf8');
  console.log(`✓ sitemap.xml — ${urls.length} URLs`);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
