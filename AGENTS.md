# Threats Dashboard

This is a standalone static Vite dashboard for source-backed Kyiv City threat reports. It will be published at `https://johnsmithkyiv.github.io/threats/` from the public `johnsmithkyiv/threats` repository.

## Data Integrity

- The dashboard counts reported threat episodes, never confirmed objects launched by Russia.
- Include only source lines explicitly naming Kyiv City or a direction toward Kyiv City.
- Exclude Kyiv Oblast alone, and preserve the original Telegram post ID, URL, timestamp, and text for every collected post.
- The only collection source is the verified Ukrainian Air Force Telegram channel, `@kpszsu`.
- Do not present this site as a live safety alerting service.

## Build

```bash
npm test
npm run collect
npm run build
```

`npm run collect -- --backfill` advances the saved chronological Telegram archive cursor toward 24 February 2022. It is bounded per run to avoid aggressive scraping.

## Deployment

- `.github/workflows/deploy.yml` runs recent collection and advances the backfill hourly. It respects Telegram retry instructions and deploys Pages only after source-derived dashboard data or code changes.
- The workflow can also run a backfill manually with the `backfill` input.
- `vite.config.ts` must keep `base: "/threats/"` for GitHub Pages.
