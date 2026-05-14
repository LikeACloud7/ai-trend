import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const dashboard = JSON.parse(await readFile('public/data/dashboard.json', 'utf8'));
const papers = JSON.parse(await readFile('data/papers.json', 'utf8'));

assert(Array.isArray(papers), 'data/papers.json must be an array');
assert(papers.length > 0, 'paper list is empty');
assert(dashboard.summary.totalPapers === dashboard.papers.length, 'dashboard paper count mismatch');
assert(dashboard.summary.totalPapers === papers.length, 'raw/public paper count mismatch');
assert(dashboard.summary.categoryTotals.some((topic) => topic.count > 0), 'category totals are empty');
assert(
  dashboard.summary.sourceCoverage.some((source) => source.status === 'ok'),
  'no source was collected successfully',
);

const requiredFields = ['id', 'title', 'year', 'conference', 'track', 'primaryCategory', 'url'];
for (const paper of dashboard.papers.slice(0, 100)) {
  for (const field of requiredFields) {
    assert(paper[field], `paper ${paper.id ?? '(unknown)'} is missing ${field}`);
  }
}

const latestYear = Math.max(...dashboard.summary.years);
const oldestYear = Math.min(...dashboard.summary.years);
assert(oldestYear >= 2023, 'dashboard includes pre-2023 papers');
assert(latestYear >= 2023, 'dashboard does not include any requested years');

console.log(
  `Verified ${papers.length} papers, ${dashboard.summary.conferences.length} conferences, ${dashboard.summary.years.join(', ')}.`,
);
