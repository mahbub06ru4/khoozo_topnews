/* =========================================================================
   Top News by Khoozo — AD CONFIGURATION
   -------------------------------------------------------------------------
   THIS IS THE ONLY FILE YOU EDIT TO CHANGE ADS. Nothing else needs touching.

   Set `network` to one of:
     'house'    — Khoozo's own promos (the default; always works, needs no approval)
     'adsense'  — Google AdSense           (needs approval)
     'adsterra' — Adsterra banners         (fast approval, no traffic minimum)
     'monetag'  — Monetag                  (no traffic minimum, $5 payout)
     'ezoic'    — Ezoic placeholders       (needs the Ezoic head script)
     'custom'   — paste any other network's HTML yourself
     'none'     — show nothing at all

   Slots are referenced by TYPE, not by id:
     leaderboard — the wide banner above the headlines  (728x90 desktop / 320x100 mobile)
     infeed      — inside the newspaper grid, repeated  (responsive)
     anchor      — the sticky bar at the bottom on phones (320x50)

   Anything you leave blank falls back to a Khoozo house ad, so the page never
   shows an empty box. See README.md → "Ads" for how to get each ID.
   ========================================================================= */
window.ADS_CONFIG = {
  network: 'adsense',

  /* ---- Google AdSense ----------------------------------------------------
     client:  the publisher ID. The same ID must also appear in the root
              domain's ads.txt — that is khoozo.com/ads.txt, NOT this
              subdomain's, because Google reads ads.txt from the root domain.
     autoAds: true lets Google place ads on the page by itself. This is all
              that is needed for review and for the first ads to appear.
     slots:   optional. Fill these in only after you create fixed ad units in
              AdSense → Ads → By ad unit, and paste each unit's numeric ID.
              Any slot left blank keeps showing a Khoozo house ad. */
  adsense: {
    client: 'ca-pub-8779372289272533',
    autoAds: true,
    slots: { leaderboard: '', infeed: '', anchor: '' },
  },

  /* ---- Adsterra ----------------------------------------------------------
     Publishers → Websites → add a Banner unit, then copy the `key` out of the
     snippet Adsterra gives you ("atOptions = {'key':'…'}"). Each size needs
     its own unit. Each banner is rendered inside its own iframe so the units
     cannot clash with one another. */
  adsterra: {
    leaderboard: { key: '', width: 728, height: 90 },
    leaderboardMobile: { key: '', width: 320, height: 100 },
    infeed: { key: '', width: 300, height: 250 },
    anchor: { key: '', width: 320, height: 50 },
  },

  /* ---- Monetag -----------------------------------------------------------
     tag: the full URL of the script Monetag gives you, e.g.
          'https://example.monetag.com/tag.min.js'  (loaded once, site-wide)
     Monetag's formats are popunder / push / vignette, which are intrusive and
     are NOT placed in the boxes below; the boxes keep showing house ads.
     Leave `tag` empty to disable. */
  monetag: { tag: '' },

  /* ---- Ezoic -------------------------------------------------------------
     Add Ezoic's own script to the <head> of every page first, then map each
     slot type to the placeholder number from the Ezoic dashboard. */
  ezoic: { leaderboard: 101, infeed: 102, anchor: 103 },

  /* ---- Any other network (Infolinks, HilltopAds, PropellerAds, a direct
     sponsor…) — paste the raw HTML/script snippet per slot type. */
  custom: { leaderboard: '', infeed: '', anchor: '' },

  /* ---- House ads ---------------------------------------------------------
     Shown when a network is not configured, so a slot is never empty.
     Edit freely: one is picked at random per slot on each page load. */
  house: [
    {
      tag: 'Khoozo App',
      title: 'সব সেবা এক অ্যাপে',
      text: 'খুঁজুন, কিনুন, এগিয়ে যান — Khoozo অ্যাপ ডাউনলোড করুন।',
      cta: 'Get the app',
      url: 'https://khoozo.com',
      color: '#0a7a57',
    },
    {
      tag: 'Khoozo Shop',
      title: 'অনলাইনে কেনাকাটা',
      text: 'ডিজিটাল পণ্য ও সেবা — বিশ্বস্ত দামে, দ্রুত ডেলিভারি।',
      cta: 'Visit shop',
      url: 'https://khoozo.com',
      color: '#e0162b',
    },
    {
      tag: 'Advertise',
      title: 'এই জায়গায় বিজ্ঞাপন দিন',
      text: 'প্রতিদিন হাজারো পাঠক — আপনার ব্র্যান্ড এখানে দেখান।',
      cta: 'support@khoozo.com',
      url: 'mailto:support@khoozo.com?subject=Advertising%20on%20Top%20News',
      color: '#1a4fd6',
    },
  ],
};
