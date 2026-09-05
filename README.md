# Kyiv Threat Reports

Static dashboard of official Ukrainian Air Force threat reports explicitly naming Kyiv City or a direction toward Kyiv City.

Published at `https://johnsmithkyiv.github.io/threats/` through GitHub Pages.

## Scope

- Coverage begins on 24 February 2022.
- A row represents a reported threat episode, not a confirmed number of launched weapons.
- Repeated reports of the same category within two hours are grouped into one episode.
- Reports that mention only Kyiv Oblast are excluded unless they explicitly state a direction toward Kyiv City.
- Each episode links to its original Telegram posts.

Categories are attack drones, jet drones, Banderol loitering munitions, cruise missiles, and ballistic missiles. The classifier uses the wording in the official source and does not infer a weapon type from a general air-raid alert.

## Sources

- Ukrainian Air Force official Telegram channel: https://t.me/kpszsu
- The public Telegram archive is scanned chronologically. Raw source text, timestamp, and post URL are stored in `data/source-posts.json` for review.

The dashboard is historical and informational only. It is not an alerting service; follow official alerts and authority guidance during an air raid.

## Commands

```bash
npm install
npm test
npm run collect
npm run collect -- --backfill
npm run build
```

`npm run collect` fetches recent archive pages. `npm run collect -- --backfill` also continues a bounded historical import from the saved cursor; rerun it until the collection status is complete.

## Deployment

`.github/workflows/deploy.yml` collects data, tests, builds, commits any collected source posts, and deploys to GitHub Pages. The scheduled job runs hourly and steadily advances the backfill. It respects Telegram `Retry-After` responses and deploys only when source-derived dashboard data or code changes.

Enable **Settings -> Pages -> Source: GitHub Actions** in the repository.
