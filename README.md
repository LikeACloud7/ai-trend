# AI Research Trend Atlas

Dashboard and data pipeline for accepted-paper trend analysis across ACL, EMNLP, ICLR, ICML, NeurIPS, and NAACL from 2023 onward.

## What It Does

- Collects ACL-family main and Findings papers from ACL Anthology event pages.
- Collects ICLR, ICML, and NeurIPS accepted papers from OpenReview venue ids.
- Classifies papers into trend categories from title, abstract, and keywords.
- Writes a UI-ready dashboard dataset to `public/data/dashboard.json`.
- Supports scheduled refresh through GitHub Actions.

## Local Commands

```bash
npm install
npm run data:update
npm run data:verify
npm run dev
```

The app runs on Vite. The data updater writes:

- `data/papers.json`: compact enriched corpus for review and quick diffs.
- `data/full/*.json`: full enriched corpus shards with abstracts, split by conference-year.
- `data/source-status.json`: source-year collection status.
- `data/run-summary.json`: compact run summary.
- `public/data/dashboard.json`: optimized data consumed by the web UI.

## Source Strategy

ACL, EMNLP, and NAACL use ACL Anthology event pages such as `https://aclanthology.org/events/acl-2025/`. Main tracks are detected from `long`, `short`, or `main` volumes. Findings volumes are detected from `findings-{conference}`.

ICLR, ICML, and NeurIPS use OpenReview API queries with `content.venueid`, such as `ICLR.cc/2026/Conference`. Years with no accepted list yet are kept in source status as empty or pending instead of being fabricated.
