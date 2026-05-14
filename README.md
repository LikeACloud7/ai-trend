# AI Research Trend Atlas

[![React](https://img.shields.io/badge/React-19-20232a?logo=react&logoColor=61dafb)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white)](https://vite.dev/)
[![Data sources](https://img.shields.io/badge/sources-ACL%20Anthology%20%2B%20OpenReview-0f766e)](#data-sources)
[![Live demo](https://img.shields.io/badge/live-demo-2563eb)](https://likeacloud7.github.io/ai-trend/)

An open dashboard and data pipeline for tracking AI research trends across major conference accepted-paper lists.

AI Research Trend Atlas collects accepted papers from ACL, EMNLP, ICLR, ICML, NeurIPS, and NAACL from 2023 onward, classifies them into research-topic categories, and serves a searchable dashboard for exploring what the field is paying attention to.

> This is an independent research utility. It is not affiliated with ACL Anthology, OpenReview, or any listed conference.

## Live Demo

Open the dashboard here:

https://likeacloud7.github.io/ai-trend/

The app is designed for quick answers to questions like:

- Which topic categories dominate accepted papers this year?
- How are LLMs, agents, multimodal models, safety, evaluation, and efficiency changing over time?
- How do topic distributions differ across ACL, EMNLP, ICLR, ICML, NeurIPS, and NAACL?
- Which papers sit behind each aggregate trend?

## Current Snapshot

The committed dataset currently contains:

| Metric | Value |
| --- | ---: |
| Papers | 51,960 |
| Conferences | 6 |
| Years | 2023-2026 |
| Collected source-years | 18 |
| Dashboard dataset | `public/data/dashboard.json` |

Coverage depends on whether a conference has published accepted-paper lists for a given year. Missing or unpublished source-years are recorded in `data/source-status.json` instead of being fabricated.

## Features

- **Accepted-paper collection** from ACL Anthology event pages and OpenReview venue IDs.
- **Main / Findings split** for ACL-family venues where Findings volumes are available.
- **Topic classification** using an explicit, editable keyword taxonomy.
- **Conference-year matrix** for comparing coverage and paper counts.
- **Topic trend chart** for seeing share changes over time.
- **Paper-level search** over titles, authors, keywords, conferences, tracks, and categories.
- **Reproducible JSON outputs** for dashboard use, audits, and downstream analysis.
- **Automation-ready refresh flow** for scheduled GitHub Actions or local cron jobs.

## Data Sources

| Conference | Source | Tracks |
| --- | --- | --- |
| ACL | ACL Anthology event pages | Main, Findings |
| EMNLP | ACL Anthology event pages | Main, Findings |
| NAACL | ACL Anthology event pages | Main, Findings |
| ICLR | OpenReview venue IDs | Main |
| ICML | OpenReview venue IDs | Main |
| NeurIPS | OpenReview venue IDs | Main |

ACL-family pages use event URLs such as:

```text
https://aclanthology.org/events/acl-2025/
```

OpenReview venues use IDs such as:

```text
ICLR.cc/2026/Conference
```

## Topic Taxonomy

Papers are assigned one primary category and may also carry secondary categories. The taxonomy lives in [`scripts/taxonomy.mjs`](scripts/taxonomy.mjs), so it can be reviewed, edited, and versioned like code.

Current categories include:

| Category | Examples of signals |
| --- | --- |
| LLMs & Foundation Models | language models, instruction tuning, scaling, LoRA |
| Agents & Tool Use | tool use, autonomous agents, workflows, multi-agent systems |
| Retrieval & Knowledge | RAG, retrieval, knowledge graphs, search, reranking |
| Multimodal & Vision-Language | VLMs, image-text, video-language, VQA |
| Reasoning & Planning | chain-of-thought, math reasoning, planning, code generation |
| Evaluation & Benchmarks | benchmarks, metrics, leaderboards, robustness |
| Alignment, Safety & Trust | hallucination, bias, privacy, jailbreaks, RLHF |
| Efficient AI & Systems | quantization, distillation, serving, latency, edge |
| Generative Models | diffusion, GANs, video generation, audio generation |
| RL, Robotics & Control | reinforcement learning, robotics, policies, control |
| Core NLP Tasks | translation, summarization, parsing, dialogue, NLI |
| Multilingual & Low-Resource | cross-lingual, dialects, typology, low-resource languages |
| Speech & Audio | ASR, TTS, speech translation, music, acoustic modeling |
| Data, Annotation & Synthetic Data | data curation, weak supervision, active learning |
| Interpretability & Analysis | probing, attribution, mechanistic interpretability |
| Optimization & Theory | convergence, learning theory, Bayesian methods |
| Domain AI & Science | medicine, biology, chemistry, climate, education |
| Other / General Methods | fallback when no stronger category matches |

The classifier is intentionally transparent. It is useful for trend exploration, not as a definitive scientific taxonomy.

## Quick Start

```bash
npm install
npm run data:update
npm run data:verify
npm run dev
```

The Vite dev server runs locally at:

```text
http://127.0.0.1:5173/
```

Build the static app:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Useful Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local Vite app |
| `npm run build` | Build the production dashboard |
| `npm run preview` | Preview the built dashboard |
| `npm run data:update` | Re-fetch sources, classify papers, and write JSON outputs |
| `npm run data:verify` | Validate the generated dataset for consistency |

You can override the year range when updating data:

```bash
YEAR_START=2023 YEAR_END=2026 npm run data:update
```

## Generated Files

The data updater writes several artifacts:

| Path | Purpose |
| --- | --- |
| `data/papers.json` | Compact paper corpus for reviews, diffs, and audits |
| `data/full/*.json` | Full enriched source shards split by conference-year |
| `data/source-status.json` | Collection status for each conference-year |
| `data/run-summary.json` | Small summary of the latest collection run |
| `public/data/dashboard.json` | UI-optimized dataset consumed by the React dashboard |

`public/data/dashboard.json` is the only file the browser app needs at runtime.

## Repository Structure

```text
.
|-- data/
|   |-- full/                 # Full per conference-year shards
|   |-- papers.json           # Compact paper corpus
|   |-- run-summary.json      # Latest run metadata
|   `-- source-status.json    # Source-year collection status
|-- public/
|   `-- data/dashboard.json   # Dataset loaded by the dashboard
|-- scripts/
|   |-- taxonomy.mjs          # Topic taxonomy and classifier
|   |-- update-data.mjs       # Source collectors and dataset builder
|   `-- verify-data.mjs       # Dataset integrity checks
|-- src/
|   |-- App.jsx               # Dashboard app shell
|   |-- fallbackDashboard.js  # Minimal fallback dataset
|   |-- main.jsx              # React entrypoint
|   `-- styles.css            # Dashboard styles
`-- vite.config.js
```

## Automation

The refresh flow is intentionally simple:

1. Run `npm run data:update`.
2. Run `npm run data:verify`.
3. Build the static dashboard with `npm run build`.
4. Commit changed JSON and static output.

This makes the project easy to run from GitHub Actions, cron, or another scheduler. The same pipeline can be mirrored into a GitHub Pages repository or hosted as a standalone static Vite app.

## Interpreting the Data

This project optimizes for transparent trend analysis, not perfect bibliographic authority.

- Always follow each paper's source URL for canonical metadata.
- Some future conference-year pages may be missing because accepted lists have not been published yet.
- OpenReview venue metadata can vary by year and conference.
- Topic classification is keyword-based and intentionally inspectable.
- Counts can change when conferences update proceedings pages or OpenReview metadata.

If you use this dataset for a report or blog post, cite the original paper pages alongside this project.

## Contributing

Contributions are welcome, especially:

- better topic taxonomy keywords,
- new conference collectors,
- source parsing fixes,
- dashboard UX improvements,
- validation checks,
- documentation and examples.

Suggested workflow:

```bash
git checkout -b feature/your-change
npm install
npm run data:verify
npm run build
```

For taxonomy changes, include a short note explaining what changed and why.

## Roadmap

- Add more conferences and workshops.
- Add per-conference topic trend pages.
- Add exportable CSV and Parquet artifacts.
- Add topic co-occurrence views.
- Add manual review tooling for taxonomy calibration.
- Add stable citation metadata for dataset releases.

## Citation

If this project helps your work, please cite the repository and link to the live dashboard:

```bibtex
@software{ai_research_trend_atlas,
  title = {AI Research Trend Atlas},
  author = {LikeACloud7},
  url = {https://github.com/LikeACloud7/ai-trend},
  year = {2026}
}
```

## License

Released under the [MIT License](LICENSE).
