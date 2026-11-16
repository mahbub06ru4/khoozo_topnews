# Top News by Khoozo

A static, zero-dependency Bangladesh newspaper directory with live headlines from Google News BD. It is hosted on GitHub Pages at **https://topnews.khoozo.com**.

## Structure
| Path | Purpose |
|---|---|
| `index.html` | Directory, live headlines, ticker, ad slots, SEO content |
| `about.html` `privacy.html` `disclaimer.html` `contact.html` | Trust pages required by ad networks |
| `css/style.css` | Mobile-first styles with light and dark themes |
| `js/app.js` | Tabs, instant search, theme, fonts, date, live news, live sports |
| `js/ads-config.js` | **The only ad file you edit** — which network and which IDs |
| `js/ads.js` | Fills the ad slots from that config, with house-ad fallback |
| `data/newspapers.json` | Newspapers and live-score sites, grouped by category |
| `data/news.json` | Latest 15 headlines, written by the fetch script |
| `data/sports.json` | Cricket and football headlines, written by the same script |
| `scripts/fetch-news.js` | RSS fetcher for Node 20+ that needs no npm install |
| `.github/workflows/update-news.yml` | Runs the fetcher every 30 minutes and commits changes |

## Local preview
```bash
node scripts/serve.js 8080
```
Then open http://localhost:8080. The JSON files can't be loaded from `file://`.

## Update the headlines by hand
```bash
node scripts/fetch-news.js
```

## Deploy
1. Push the repo to GitHub, then go to **Settings → Pages** and choose *Deploy from branch*, `main`, `/ (root)`.
2. At your DNS provider, add a `CNAME` record that points `topnews` to `<your-username>.github.io`.
3. Go to **Settings → Actions → General → Workflow permissions** and choose *Read and write*.

## Ads

All ad code lives in **`js/ads-config.js`** — it is the only file you edit. `js/ads.js`
fills every `[data-ad-type]` box from it, and anything left blank falls back to a Khoozo
house ad so no slot is ever empty.

There are three slot types: `leaderboard` (above the headlines), `infeed` (inside the
newspaper grid) and `anchor` (the sticky bar on phones).

```js
window.ADS_CONFIG = { network: 'adsterra', /* … */ };
```

| `network` | Approval | Notes |
|---|---|---|
| `house` | none | **Default.** Khoozo's own promos — edit the `house` array. |
| `adsense` | strict | Needs a `ca-pub-` client ID plus an ad-unit ID per slot. Also put the ID in `ads.txt`. |
| `adsterra` | fast, no traffic minimum | Banner units; paste the `key` from each unit's snippet. Each banner renders in its own iframe. |
| `monetag` | no traffic minimum, $5 payout | Popunder/push/vignette — a site-wide tag only. The boxes keep showing house ads. |
| `ezoic` | needs the Ezoic head script | Map each slot to its placeholder number. |
| `custom` | — | Paste any other network's snippet (Infolinks, HilltopAds, PropellerAds, a direct sponsor). |
| `none` | — | Removes the slots entirely. |

Preview a network before switching the site over by adding `?ads=` to any URL — e.g.
`https://topnews.khoozo.com/?ads=adsterra`, or `?ads=off` to see the page with no slots at
all. It only affects your own browser.

Because this site is a directory of outbound links and syndicated headlines, AdSense often
rejects it as "low value content". The networks above do not have that restriction;
Adsterra and Monetag are the usual fallbacks and both pay out via Payoneer, which works in
Bangladesh. Monetag's formats are intrusive by nature, so prefer Adsterra banners or a
direct sponsor if you care about the reading experience.

To improve the odds with AdSense later, grow the original writing (the category intros and
editorial sections are the parts AdSense counts) rather than the number of links.

## Add a newspaper
Add an object to `data/newspapers.json`:
```json
{ "name_bn": "…", "name_en": "…", "url": "https://…", "category": "bangla" }
```
The category must be one of: `bangla`, `online`, `tv`, `epaper`, `english`, `local`, `jobs`, `international`.
