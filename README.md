# Top News by Khoozo

A static, zero-dependency Bangladesh newspaper directory with live headlines from Google News BD. It is hosted on GitHub Pages at **https://topnews.khoozo.com**.

## Structure
| Path | Purpose |
|---|---|
| `index.html` | Directory, live headlines, ticker, ad slots, SEO content |
| `about.html` `privacy.html` `disclaimer.html` `contact.html` | AdSense trust pages |
| `css/style.css` | Mobile-first styles with light and dark themes |
| `js/app.js` | Tabs, instant search, theme, date, live news, in-feed ads |
| `data/newspapers.json` | 82 newspapers in 8 categories |
| `data/news.json` | Latest 15 headlines, written by the fetch script |
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

## AdSense
- Uncomment the AdSense `<script>` in the `<head>` of `index.html` and add your `ca-pub-` ID.
- Replace the placeholder text in each `.ad-slot` with your `<ins class="adsbygoogle">` units. The in-feed units are created in `inFeedAd()` in `js/app.js`.
- Put your publisher ID in `ads.txt`.

## Add a newspaper
Add an object to `data/newspapers.json`:
```json
{ "name_bn": "…", "name_en": "…", "url": "https://…", "category": "bangla" }
```
The category must be one of: `bangla`, `online`, `tv`, `epaper`, `english`, `local`, `jobs`, `international`.
