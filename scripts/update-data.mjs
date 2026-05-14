import { mkdir, rm, writeFile } from 'node:fs/promises';
import { classifyPaper, decodeHtml, getTopic, TOPIC_TAXONOMY } from './taxonomy.mjs';

const YEAR_START = Number.parseInt(process.env.YEAR_START ?? '2023', 10);
const YEAR_END = Number.parseInt(process.env.YEAR_END ?? `${new Date().getUTCFullYear()}`, 10);
const OPENREVIEW_API = 'https://api2.openreview.net/notes';
const OPENREVIEW_LEGACY_API = 'https://api.openreview.net/notes';
const USER_AGENT = 'ai-research-trend-atlas/0.1 (+https://github.com/LikeACloud7/ai-trend)';

const ACL_FAMILY = [
  { id: 'acl', name: 'ACL', event: 'acl', mainSuffixes: ['long', 'short', 'main'] },
  { id: 'emnlp', name: 'EMNLP', event: 'emnlp', mainSuffixes: ['main', 'long', 'short'] },
  { id: 'naacl', name: 'NAACL', event: 'naacl', mainSuffixes: ['main', 'long', 'short'] },
];

const OPENREVIEW_FAMILY = [
  { id: 'iclr', name: 'ICLR', venuePrefix: 'ICLR.cc' },
  { id: 'icml', name: 'ICML', venuePrefix: 'ICML.cc' },
  { id: 'neurips', name: 'NeurIPS', venuePrefix: 'NeurIPS.cc' },
];

const TRACK_LABELS = {
  main: 'Main',
  findings: 'Findings',
};

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'user-agent': USER_AGENT,
      accept: options.accept ?? 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} for ${url}`);
    error.status = response.status;
    throw error;
  }

  return response.text();
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url, { accept: 'application/json' }));
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function valueOf(field, fallback = '') {
  if (field == null) return fallback;
  if (typeof field === 'object' && 'value' in field) return field.value ?? fallback;
  return field;
}

function listOf(field) {
  const value = valueOf(field, []);
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function isNonPaperTitle(title) {
  return /^(proceedings|front matter|preface|table of contents|message from|welcome message|program chairs?' report|committee|organizing committee)/i.test(
    title,
  );
}

function compactPaper(paper) {
  return {
    id: paper.id,
    title: paper.title,
    authors: paper.authors.slice(0, 8),
    year: paper.year,
    conference: paper.conference,
    conferenceName: paper.conferenceName,
    track: paper.track,
    trackLabel: TRACK_LABELS[paper.track] ?? paper.track,
    source: paper.source,
    url: paper.url,
    keywords: paper.keywords ?? [],
    primaryCategory: paper.primaryCategory,
    categories: paper.categories,
  };
}

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function volumeToSectionId(volumeId) {
  return volumeId.replaceAll('.', '');
}

function discoverAclVolumesFromEvent(html, conf, year) {
  const volumes = [];
  const seen = new Set();
  const volumeRegex = /href=\/volumes\/([^/]+)\/>([\s\S]*?)<\/a>/g;
  let match;

  while ((match = volumeRegex.exec(html))) {
    const volumeId = match[1];
    if (seen.has(volumeId)) continue;
    seen.add(volumeId);

    const title = decodeHtml(match[2]);
    const prefix = `${year}.${conf.event}-`;
    const suffix = volumeId.startsWith(prefix) ? volumeId.slice(prefix.length) : '';
    const findingsId = `${year}.findings-${conf.event}`;

    if (volumeId === findingsId) {
      volumes.push({ volumeId, title, track: 'findings', subtype: 'findings' });
    } else if (volumeId.startsWith(prefix) && conf.mainSuffixes.includes(suffix)) {
      volumes.push({ volumeId, title, track: 'main', subtype: suffix });
    }
  }

  return volumes;
}

function extractVolumeSection(html, volumeId) {
  const marker = `<div id=${volumeToSectionId(volumeId)}>`;
  const start = html.indexOf(marker);
  if (start === -1) return '';
  const next = html.indexOf('<hr><div id=', start + marker.length);
  return html.slice(start, next === -1 ? undefined : next);
}

function extractAuthors(chunk) {
  const start = chunk.indexOf('</strong><br>');
  const end = chunk.indexOf('</span></div>', start);
  if (start === -1 || end === -1) return [];

  const authorHtml = chunk.slice(start + '</strong><br>'.length, end);
  const authors = [];
  const authorRegex = /<a[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = authorRegex.exec(authorHtml))) {
    const author = decodeHtml(match[1]);
    if (author && !authors.includes(author)) authors.push(author);
  }
  return authors;
}

function extractAbstract(chunk) {
  const match = chunk.match(/<div class="card-body p-3 small">([\s\S]*?)<\/div><\/div>/);
  return decodeHtml(match?.[1] ?? '');
}

function parseAclVolumeSection(section, conf, year, volume) {
  const paperLinkRegex = /<strong><a class=align-middle href=\/([0-9]{4}\.[^/]+?\.\d+)\/>([\s\S]*?)<\/a><\/strong><br>/g;
  const matches = Array.from(section.matchAll(paperLinkRegex));

  return matches
    .map((match, index) => {
      const id = match[1];
      const ordinal = Number.parseInt(id.split('.').at(-1), 10);
      const title = decodeHtml(match[2]);
      const nextIndex = matches[index + 1]?.index ?? section.length;
      const chunk = section.slice(match.index, nextIndex);

      return {
        id,
        title,
        authors: extractAuthors(chunk),
        abstract: extractAbstract(chunk),
        year,
        conference: conf.id,
        conferenceName: conf.name,
        track: volume.track,
        subtype: volume.subtype,
        source: 'ACL Anthology',
        sourceVolume: volume.volumeId,
        sourceVolumeTitle: volume.title,
        url: `https://aclanthology.org/${id}/`,
        keywords: [],
        ordinal,
      };
    })
    .filter((paper) => paper.ordinal > 0 && paper.title && !isNonPaperTitle(paper.title));
}

async function collectAclFamily() {
  const papers = [];
  const statuses = [];

  for (const conf of ACL_FAMILY) {
    for (const year of range(YEAR_START, YEAR_END)) {
      const eventUrl = `https://aclanthology.org/events/${conf.event}-${year}/`;
      try {
        const html = await fetchText(eventUrl);
        const volumes = discoverAclVolumesFromEvent(html, conf, year);
        const yearPapers = [];

        for (const volume of volumes) {
          const section = extractVolumeSection(html, volume.volumeId);
          const parsed = parseAclVolumeSection(section, conf, year, volume);
          yearPapers.push(...parsed);
        }

        papers.push(...yearPapers);
        statuses.push({
          conference: conf.id,
          conferenceName: conf.name,
          year,
          source: 'ACL Anthology',
          url: eventUrl,
          status: yearPapers.length ? 'ok' : 'empty',
          papers: yearPapers.length,
          volumes: volumes.map((volume) => volume.volumeId),
        });
        console.log(`${conf.name} ${year}: ${yearPapers.length} papers from ${volumes.length} volumes`);
      } catch (error) {
        statuses.push({
          conference: conf.id,
          conferenceName: conf.name,
          year,
          source: 'ACL Anthology',
          url: eventUrl,
          status: error.status === 404 ? 'not_published' : 'error',
          papers: 0,
          error: error.message,
        });
        console.warn(`${conf.name} ${year}: ${error.message}`);
      }
    }
  }

  return { papers, statuses };
}

async function fetchOpenReviewNotes(apiUrl, venueId) {
  const limit = 1000;
  let offset = 0;
  const notes = [];

  while (true) {
    const params = new URLSearchParams({
      'content.venueid': venueId,
      limit: String(limit),
      offset: String(offset),
    });
    const json = await fetchJson(`${apiUrl}?${params.toString()}`);
    const page = json.notes ?? [];
    notes.push(...page);
    if (page.length < limit) break;
    offset += limit;
  }

  return notes;
}

async function collectOpenReviewVenue(conf, year) {
  const venueId = `${conf.venuePrefix}/${year}/Conference`;
  let notes = await fetchOpenReviewNotes(OPENREVIEW_API, venueId);
  let apiSource = 'OpenReview API2';

  if (!notes.length) {
    const legacyNotes = await fetchOpenReviewNotes(OPENREVIEW_LEGACY_API, venueId);
    if (legacyNotes.length) {
      notes = legacyNotes;
      apiSource = 'OpenReview Legacy API';
    }
  }

  return notes.map((note, index) => {
    const content = note.content ?? {};
    const title = normalizeWhitespace(valueOf(content.title));
    const venue = normalizeWhitespace(valueOf(content.venue));
    const venueText = venue.toLowerCase();
    const presentation =
      venueText.includes('oral') || venueText.includes('spotlight') || venueText.includes('poster')
        ? venue.replace(/^.*?\b(oral|spotlight|poster)\b.*$/i, '$1').toLowerCase()
        : '';

    return {
      id: note.id,
      title,
      authors: listOf(content.authors),
      abstract: normalizeWhitespace(valueOf(content.abstract)),
      year,
      conference: conf.id,
      conferenceName: conf.name,
      track: 'main',
      subtype: presentation || 'accepted',
      source: 'OpenReview',
      sourceApi: apiSource,
      sourceVenueId: venueId,
      url: `https://openreview.net/forum?id=${note.id}`,
      keywords: listOf(content.keywords),
      ordinal: index + 1,
    };
  });
}

async function collectOpenReviewFamily() {
  const papers = [];
  const statuses = [];

  for (const conf of OPENREVIEW_FAMILY) {
    for (const year of range(YEAR_START, YEAR_END)) {
      const venueId = `${conf.venuePrefix}/${year}/Conference`;
      try {
        const yearPapers = await collectOpenReviewVenue(conf, year);
        papers.push(...yearPapers);
        statuses.push({
          conference: conf.id,
          conferenceName: conf.name,
          year,
          source: 'OpenReview',
          url: `https://openreview.net/group?id=${venueId}`,
          status: yearPapers.length ? 'ok' : 'empty',
          papers: yearPapers.length,
          venueId,
        });
        console.log(`${conf.name} ${year}: ${yearPapers.length} papers from ${venueId}`);
      } catch (error) {
        statuses.push({
          conference: conf.id,
          conferenceName: conf.name,
          year,
          source: 'OpenReview',
          url: `https://openreview.net/group?id=${venueId}`,
          status: 'error',
          papers: 0,
          venueId,
          error: error.message,
        });
        console.warn(`${conf.name} ${year}: ${error.message}`);
      }
    }
  }

  return { papers, statuses };
}

function aggregatePapers(papers, statuses) {
  const conferences = [...new Map(papers.map((paper) => [paper.conference, paper.conferenceName])).entries()].map(
    ([id, name]) => ({ id, name }),
  );
  const years = [...new Set(papers.map((paper) => paper.year))].sort((a, b) => a - b);
  const totalsByCategory = new Map(TOPIC_TAXONOMY.map((topic) => [topic.id, 0]));
  const matrixMap = new Map();
  const trackMap = new Map();
  const yearCategoryMap = new Map();
  const conferenceCategoryMap = new Map();

  for (const paper of papers) {
    totalsByCategory.set(paper.primaryCategory, (totalsByCategory.get(paper.primaryCategory) ?? 0) + 1);

    const matrixKey = `${paper.conference}:${paper.year}`;
    if (!matrixMap.has(matrixKey)) {
      matrixMap.set(matrixKey, {
        conference: paper.conference,
        conferenceName: paper.conferenceName,
        year: paper.year,
        total: 0,
        tracks: { main: 0, findings: 0 },
        categories: Object.fromEntries(TOPIC_TAXONOMY.map((topic) => [topic.id, 0])),
      });
    }
    const cell = matrixMap.get(matrixKey);
    cell.total += 1;
    cell.tracks[paper.track] = (cell.tracks[paper.track] ?? 0) + 1;
    cell.categories[paper.primaryCategory] = (cell.categories[paper.primaryCategory] ?? 0) + 1;

    const trackKey = `${paper.conference}:${paper.year}:${paper.track}`;
    trackMap.set(trackKey, (trackMap.get(trackKey) ?? 0) + 1);

    const yearMap = yearCategoryMap.get(paper.year) ?? new Map();
    yearMap.set(paper.primaryCategory, (yearMap.get(paper.primaryCategory) ?? 0) + 1);
    yearCategoryMap.set(paper.year, yearMap);

    const confMap = conferenceCategoryMap.get(paper.conference) ?? new Map();
    confMap.set(paper.primaryCategory, (confMap.get(paper.primaryCategory) ?? 0) + 1);
    conferenceCategoryMap.set(paper.conference, confMap);
  }

  const categoryTotals = TOPIC_TAXONOMY.map((topic) => ({
    id: topic.id,
    label: topic.label,
    color: topic.color,
    count: totalsByCategory.get(topic.id) ?? 0,
    share: papers.length ? (totalsByCategory.get(topic.id) ?? 0) / papers.length : 0,
  })).sort((a, b) => b.count - a.count);

  const recentYears = years.slice(-2);
  const baselineYears = years.slice(0, Math.min(2, years.length));
  const countInYears = (topicId, selectedYears) =>
    selectedYears.reduce((sum, year) => sum + (yearCategoryMap.get(year)?.get(topicId) ?? 0), 0);
  const totalInYears = (selectedYears) =>
    selectedYears.reduce(
      (sum, year) =>
        sum + [...(yearCategoryMap.get(year)?.values() ?? [])].reduce((yearSum, count) => yearSum + count, 0),
      0,
    );
  const recentTotal = totalInYears(recentYears);
  const baselineTotal = totalInYears(baselineYears);

  const momentum = TOPIC_TAXONOMY.filter((topic) => topic.id !== 'other')
    .map((topic) => {
      const recentShare = recentTotal ? countInYears(topic.id, recentYears) / recentTotal : 0;
      const baselineShare = baselineTotal ? countInYears(topic.id, baselineYears) / baselineTotal : 0;
      return {
        id: topic.id,
        label: topic.label,
        color: topic.color,
        recentShare,
        baselineShare,
        delta: recentShare - baselineShare,
        recentCount: countInYears(topic.id, recentYears),
      };
    })
    .sort((a, b) => b.delta - a.delta);

  const yearlyTopicSeries = years.map((year) => {
    const yearMap = yearCategoryMap.get(year) ?? new Map();
    const total = [...yearMap.values()].reduce((sum, count) => sum + count, 0);
    return {
      year,
      total,
      categories: Object.fromEntries(
        TOPIC_TAXONOMY.map((topic) => {
          const count = yearMap.get(topic.id) ?? 0;
          return [topic.id, { count, share: total ? count / total : 0 }];
        }),
      ),
    };
  });

  const sourceCoverage = statuses.map((status) => ({
    ...status,
    displayStatus:
      status.status === 'ok'
        ? 'Collected'
        : status.status === 'empty'
          ? 'No accepted list yet'
          : status.status === 'not_published'
            ? 'Not published'
            : 'Check needed',
  }));

  return {
    totalPapers: papers.length,
    conferences,
    years,
    categories: TOPIC_TAXONOMY,
    categoryTotals,
    conferenceYearMatrix: [...matrixMap.values()].sort(
      (a, b) => a.conferenceName.localeCompare(b.conferenceName) || a.year - b.year,
    ),
    trackTotals: [...trackMap.entries()].map(([key, count]) => {
      const [conference, year, track] = key.split(':');
      return { conference, year: Number(year), track, count };
    }),
    yearlyTopicSeries,
    momentum,
    sourceCoverage,
  };
}

async function main() {
  await mkdir('data', { recursive: true });
  await rm('data/full', { recursive: true, force: true });
  await mkdir('data/full', { recursive: true });
  await mkdir('public/data', { recursive: true });

  const [acl, openreview] = await Promise.all([collectAclFamily(), collectOpenReviewFamily()]);
  const rawPapers = [...acl.papers, ...openreview.papers].filter((paper) => paper.title);
  const seen = new Set();
  const classifiedPapers = [];

  for (const paper of rawPapers) {
    const key = `${paper.source}:${paper.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const classification = classifyPaper(paper);
    classifiedPapers.push({
      ...paper,
      primaryCategory: classification.primaryCategory,
      categories: classification.categories,
      categoryScores: classification.categoryScores,
    });
  }

  classifiedPapers.sort(
    (a, b) =>
      a.year - b.year ||
      a.conferenceName.localeCompare(b.conferenceName) ||
      a.track.localeCompare(b.track) ||
      a.title.localeCompare(b.title),
  );

  const statuses = [...acl.statuses, ...openreview.statuses];
  const summary = aggregatePapers(classifiedPapers, statuses);
  const generatedAt = new Date().toISOString();
  const compactPapers = classifiedPapers.map(compactPaper);
  const dashboard = {
    generatedAt,
    yearStart: YEAR_START,
    yearEnd: YEAR_END,
    summary,
    papers: compactPapers,
  };

  const shards = new Map();
  for (const paper of classifiedPapers) {
    const shardName = `${paper.conference}-${paper.year}.json`;
    const shard = shards.get(shardName) ?? [];
    shard.push(paper);
    shards.set(shardName, shard);
  }

  for (const [shardName, shardPapers] of shards) {
    await writeFile(`data/full/${shardName}`, `${JSON.stringify(shardPapers, null, 2)}\n`);
  }

  await writeFile('data/papers.json', `${JSON.stringify(compactPapers, null, 2)}\n`);
  await writeFile('data/source-status.json', `${JSON.stringify(statuses, null, 2)}\n`);
  await writeFile('public/data/dashboard.json', `${JSON.stringify(dashboard)}\n`);
  await writeFile(
    'data/run-summary.json',
    `${JSON.stringify(
      {
        generatedAt,
        totalPapers: classifiedPapers.length,
        yearStart: YEAR_START,
        yearEnd: YEAR_END,
        fullDataShards: [...shards.keys()].sort().map((name) => `data/full/${name}`),
        collected: statuses.filter((status) => status.status === 'ok'),
        missingOrEmpty: statuses.filter((status) => status.status !== 'ok'),
        topCategories: summary.categoryTotals.slice(0, 10).map((topic) => ({
          topic: getTopic(topic.id).label,
          count: topic.count,
          share: topic.share,
        })),
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Wrote ${classifiedPapers.length} papers to compact data plus ${shards.size} full-data shards`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
