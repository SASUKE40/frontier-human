# FrontierHuman

An intent-detection benchmark for humans. An AI agent asks a clarifying question ("Should I delete the old migration?"), the human answers tersely ("or", "yes", "b I guess", "a, wait no"), and you pick what they actually meant, the way a strong agent would.

**Take it:** https://edward40.com/frontier-human/

- 20 items across six categories: trailing "or", non-answers, ordinal reference, pointers & repair, implicit constraint, sarcasm & hedging.
- 15 hard and 5 medium. Each wrong option is a documented agent failure mode, and many are the answer a strong model would give.
- English and Simplified Chinese (EN / 中 toggle; defaults to the browser language). The Chinese items are adapted, not word-for-word, so each keeps its ambiguity (trailing "or" becomes 还是…).
- The report shows your score, verdict, a rubric of all five bands with yours highlighted, comparisons with strong-agent and literal-reader baselines, per-category criteria and an explanation for every item.
- Magic link: finishing puts `?r=<version>.<code>` in the URL. The code packs your answers (2 bits each, plus a checksum) in base64url, so the link rebuilds the same report on any device with no backend. Links from an older version of the exam, or damaged links, show a notice instead.
- Share to X, LinkedIn, Facebook, Reddit, Weibo, WeChat (QR code) or the system share sheet.
- Brutalist blue design with light and dark themes (follows `prefers-color-scheme`; the toggle choice is saved).
- Google Analytics (GA4). The measurement ID is set once, in the first script in `site/index.html`.

## Layout

| Path | What |
| --- | --- |
| `research.md` | Research summary with sources |
| `site/data/items.json` | The 20 exam items (English) |
| `site/data/items.zh.json` | Chinese text for the same items, keyed by id |
| `site/vendor/qrcode.js` | qrcode-generator 1.5.2 (MIT), for the WeChat QR |
| `site/og.png` | Social card, rendered from `tools/og.html` by `tools/render-og.mjs` (needs Playwright) |
| `site/` | Static site (plain HTML/CSS/JS, no build step) |
| `.github/workflows/pages.yml` | Validates both item files and deploys `site/` to GitHub Pages on push to `main` |

## Run locally

```sh
python3 -m http.server 8000 --directory site
# open http://localhost:8000
```

Answers are kept in `localStorage` and the magic link.
