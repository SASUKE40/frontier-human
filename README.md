# FrontierHuman

An intent-detection benchmark for humans. An AI agent asks a clarifying question ("Should I delete the old migration?"), the human answers tersely ("or", "yes", "b I guess", "a, wait no"), and you pick what they actually meant, the way a strong agent would.

**Take it:** https://edward40.com/frontier-human/

- 20 items across six categories: trailing "or", non-answers, ordinal reference, pointers & repair, implicit constraint, sarcasm & hedging.
- 15 hard and 5 medium. Each wrong option is a documented agent failure mode, and many are the answer a strong model would give.
- The report shows your score, category and difficulty breakdowns, a verdict band, a comparison with strong-agent and literal-reader baselines, and an explanation for every item.
- Brutalist design with light and dark themes (follows `prefers-color-scheme`; the toggle choice is saved).

## Layout

| Path | What |
| --- | --- |
| `research.md` | Research summary with sources (ClarQ, ClariQ, AmbigQA, CLAMBER, Ambig-SWE, multi-turn grounding work) |
| `site/data/items.json` | The 20 exam items |
| `site/` | Static site (plain HTML/CSS/JS, no build step) |
| `.github/workflows/pages.yml` | Validates the items and deploys `site/` to GitHub Pages on push to `main` |

## Run locally

```sh
python3 -m http.server 8000 --directory site
# open http://localhost:8000
```

Everything runs in the browser. Answers are kept in `localStorage` only.
