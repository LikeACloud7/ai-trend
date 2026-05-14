import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Database,
  Filter,
  Flame,
  Github,
  Percent,
  RefreshCcw,
  Search,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { fallbackDashboard } from './fallbackDashboard.js';

const CATEGORY_LIMIT = 10;
const TREND_LIMIT = 6;
const STACK_LIMIT = 9;

const LATEX_REPLACEMENTS = {
  alpha: 'alpha',
  beta: 'beta',
  gamma: 'gamma',
  delta: 'delta',
  Delta: 'Delta',
  epsilon: 'epsilon',
  theta: 'theta',
  lambda: 'lambda',
  mu: 'mu',
  pi: 'pi',
  sigma: 'sigma',
  Sigma: 'Sigma',
  phi: 'phi',
  Phi: 'Phi',
  omega: 'omega',
  Omega: 'Omega',
  times: 'x',
  leq: '<=',
  geq: '>=',
  neq: '!=',
  approx: '~',
  infty: 'infinity',
  natural: 'natural',
};

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value ?? 0);
}

function percent(value, digits = 1) {
  return `${((value ?? 0) * 100).toFixed(digits)}%`;
}

function percentagePoints(value, digits = 1) {
  const number = ((value ?? 0) * 100).toFixed(digits);
  return `${value >= 0 ? '+' : ''}${number} pp`;
}

function cleanPaperTitle(value) {
  if (!value) return '';
  let title = value;

  for (let i = 0; i < 4; i += 1) {
    title = title.replace(/\\(?:textit|textbf|texttt|text|mathrm|mathsf|mathcal|mathscr|mathbb|operatorname)\{([^{}]*)\}/g, '$1');
    title = title.replace(/\\acute\{e\}/g, 'e');
    title = title.replace(/\\[a-zA-Z]+\{([^{}]*)\}/g, '$1');
  }

  return title
    .replace(/\$/g, '')
    .replace(/\\([a-zA-Z]+)/g, (_, command) => LATEX_REPLACEMENTS[command] ?? command)
    .replace(/\\([#$%&_^{}])/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDate(value) {
  if (!value) return 'Not generated yet';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getTopic(dashboard, topicId) {
  return dashboard.summary.categories.find((topic) => topic.id === topicId) ?? {
    id: topicId,
    label: topicId,
    color: '#64748b',
  };
}

function getActiveYears(dashboard, filters) {
  return dashboard.summary.years.filter((year) => filters.years.has(year));
}

function getActiveConferences(dashboard, filters) {
  return dashboard.summary.conferences.filter((conference) => filters.conferences.has(conference.id));
}

function normalizeFilters(dashboard) {
  return {
    conferences: new Set(dashboard.summary.conferences.map((conference) => conference.id)),
    years: new Set(dashboard.summary.years),
    query: '',
    category: 'all',
  };
}

function useDashboard() {
  const [state, setState] = useState({ dashboard: fallbackDashboard, loading: true, error: '' });

  useEffect(() => {
    let alive = true;
    fetch('/data/dashboard.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`No generated dashboard found (${response.status})`);
        return response.json();
      })
      .then((dashboard) => {
        if (alive) setState({ dashboard, loading: false, error: '' });
      })
      .catch((error) => {
        if (alive) setState({ dashboard: fallbackDashboard, loading: false, error: error.message });
      });

    return () => {
      alive = false;
    };
  }, []);

  return state;
}

function ToggleButton({ active, children, onClick }) {
  return (
    <button className={`toggle ${active ? 'toggle-active' : ''}`} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function Sidebar({ dashboard, filters, setFilters }) {
  const toggleSet = (key, value) => {
    setFilters((current) => {
      const next = new Set(current[key]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...current, [key]: next };
    });
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Activity size={20} />
        </div>
        <div>
          <strong>AI Research</strong>
          <span>Trend Atlas</span>
        </div>
      </div>

      <div className="filter-card">
        <div className="filter-heading">
          <Filter size={16} />
          Conferences
        </div>
        <div className="check-list">
          {dashboard.summary.conferences.map((conference) => (
            <label key={conference.id} className="check-row">
              <input
                type="checkbox"
                checked={filters.conferences.has(conference.id)}
                onChange={() => toggleSet('conferences', conference.id)}
              />
              <span>{conference.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="filter-card">
        <div className="filter-heading">
          <CalendarClock size={16} />
          Years
        </div>
        <div className="year-grid">
          {dashboard.summary.years.map((year) => (
            <ToggleButton key={year} active={filters.years.has(year)} onClick={() => toggleSet('years', year)}>
              {year}
            </ToggleButton>
          ))}
        </div>
      </div>

      <div className="filter-card">
        <div className="filter-heading">
          <Sparkles size={16} />
          Topic
        </div>
        <select
          value={filters.category}
          onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
        >
          <option value="all">All categories</option>
          {dashboard.summary.categories.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.label}
            </option>
          ))}
        </select>
      </div>

      <button className="reset-button" onClick={() => setFilters(normalizeFilters(dashboard))} type="button">
        <RefreshCcw size={15} />
        Reset filters
      </button>
    </aside>
  );
}

function Header({ dashboard, loading, sourceError, filters, setFilters }) {
  return (
    <header className="topbar">
      <div>
        <h1>AI Research Trend Atlas</h1>
        <p>
          Accepted-paper topic analytics for ACL, EMNLP, ICLR, ICML, NeurIPS, and NAACL from {dashboard.yearStart}.
        </p>
      </div>
      <div className="topbar-actions">
        <div className="search-box">
          <Search size={16} />
          <input
            value={filters.query}
            onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
            placeholder="Search titles, authors, keywords"
          />
        </div>
        <a className="icon-link" href="https://github.com/LikeACloud7/ai-trend" target="_blank" rel="noreferrer">
          <Github size={17} />
        </a>
      </div>
      <div className={`status-strip ${sourceError ? 'status-warning' : ''}`}>
        <CheckCircle2 size={15} />
        <span>{loading ? 'Loading generated data' : sourceError ? 'Using fallback sample data' : 'Generated data loaded'}</span>
      </div>
    </header>
  );
}

function StatCard({ icon: Icon, label, value, detail }) {
  return (
    <section className="stat-card">
      <div className="stat-icon">
        <Icon size={18} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </section>
  );
}

function getFilteredPapers(dashboard, filters) {
  const query = filters.query.trim().toLowerCase();
  return dashboard.papers.filter((paper) => {
    if (!filters.conferences.has(paper.conference)) return false;
    if (!filters.years.has(paper.year)) return false;
    if (filters.category !== 'all' && !paper.categories.includes(filters.category)) return false;
    if (!query) return true;
    const haystack = `${paper.title} ${cleanPaperTitle(paper.title)} ${paper.authors.join(' ')} ${(paper.keywords ?? []).join(' ')}`.toLowerCase();
    return haystack.includes(query);
  });
}

function computeCategoryTotals(dashboard, papers) {
  const totals = new Map(dashboard.summary.categories.map((topic) => [topic.id, 0]));
  for (const paper of papers) {
    totals.set(paper.primaryCategory, (totals.get(paper.primaryCategory) ?? 0) + 1);
  }
  return dashboard.summary.categories
    .map((topic) => ({
      ...topic,
      count: totals.get(topic.id) ?? 0,
      share: papers.length ? (totals.get(topic.id) ?? 0) / papers.length : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function buildTopicStats(dashboard, papers) {
  const stats = new Map(
    dashboard.summary.categories.map((topic) => [
      topic.id,
      {
        ...topic,
        count: 0,
        share: 0,
      },
    ]),
  );

  for (const paper of papers) {
    const topic = stats.get(paper.primaryCategory);
    if (topic) topic.count += 1;
  }

  return Array.from(stats.values()).map((topic) => ({
    ...topic,
    share: papers.length ? topic.count / papers.length : 0,
  }));
}

function computeYearlyTopicSeries(dashboard, papers, years) {
  const topicIds = dashboard.summary.categories.map((topic) => topic.id);
  return years.map((year) => {
    const yearPapers = papers.filter((paper) => paper.year === year);
    const counts = Object.fromEntries(topicIds.map((topicId) => [topicId, { count: 0, share: 0 }]));

    for (const paper of yearPapers) {
      if (counts[paper.primaryCategory]) counts[paper.primaryCategory].count += 1;
    }

    for (const topicId of topicIds) {
      counts[topicId].share = yearPapers.length ? counts[topicId].count / yearPapers.length : 0;
    }

    return {
      year,
      total: yearPapers.length,
      categories: counts,
    };
  });
}

function computeTopicMomentum(dashboard, yearlySeries) {
  const populated = yearlySeries.filter((item) => item.total > 0);
  const baseline = populated[0];
  const recent = populated.at(-1);

  return dashboard.summary.categories
    .map((topic) => {
      const baselineStats = baseline?.categories?.[topic.id] ?? { count: 0, share: 0 };
      const recentStats = recent?.categories?.[topic.id] ?? { count: 0, share: 0 };
      return {
        ...topic,
        baselineYear: baseline?.year,
        recentYear: recent?.year,
        baselineShare: baselineStats.share,
        recentShare: recentStats.share,
        delta: recentStats.share - baselineStats.share,
        recentCount: recentStats.count,
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function summarizeTopicSet(dashboard, papers) {
  const stats = buildTopicStats(dashboard, papers).sort((a, b) => b.count - a.count);
  return {
    total: papers.length,
    topics: stats,
    topTopic: stats.find((topic) => topic.count > 0),
  };
}

function computeConferenceCoverage(dashboard) {
  return dashboard.summary.conferences.map((conference) => {
    const sources = dashboard.summary.sourceCoverage.filter((source) => source.conference === conference.id);
    const collected = sources.filter((source) => source.status === 'ok');
    const latestSource = [...sources].sort((a, b) => b.year - a.year)[0];
    const latestCollected = [...collected].sort((a, b) => b.year - a.year)[0];

    return {
      id: conference.id,
      name: conference.name,
      collected: collected.length,
      total: sources.length || dashboard.summary.years.length,
      latestCollectedYear: latestCollected?.year,
      latestStatus: latestSource?.displayStatus ?? 'No source',
      latestYear: latestSource?.year,
      url: latestCollected?.url ?? latestSource?.url,
    };
  });
}

function TopicBars({ topics, total }) {
  const top = topics.filter((topic) => topic.count > 0).slice(0, CATEGORY_LIMIT);
  const max = Math.max(...top.map((topic) => topic.count), 1);

  return (
    <section className="panel topic-bars">
      <div className="panel-heading">
        <div>
          <h2>Selected Corpus Topic Mix</h2>
          <p>Primary topic share in the current conference, year, topic, and search filter.</p>
        </div>
        <span>{formatNumber(total)} papers</span>
      </div>
      <div className="bars">
        {top.map((topic) => (
          <div className="bar-row" key={topic.id}>
            <div className="bar-label">
              <span className="dot" style={{ background: topic.color }} />
              <strong>{topic.label}</strong>
            </div>
            <div className="bar-track">
              <span style={{ width: `${Math.max(4, (topic.count / max) * 100)}%`, background: topic.color }} />
            </div>
            <div className="bar-value">
              <strong>{formatNumber(topic.count)}</strong>
              <small>{percent(topic.share)}</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ConferenceYearLeaders({ dashboard, papers, conferences, years }) {
  const counts = useMemo(() => {
    const map = new Map();
    for (const paper of papers) {
      const key = `${paper.conference}:${paper.year}`;
      const current = map.get(key) ?? { total: 0, categories: new Map() };
      current.total += 1;
      current.categories.set(paper.primaryCategory, (current.categories.get(paper.primaryCategory) ?? 0) + 1);
      map.set(key, current);
    }
    return map;
  }, [papers]);

  const max = Math.max(...Array.from(counts.values()).map((item) => item.total), 1);

  return (
    <section className="panel matrix-panel">
      <div className="panel-heading">
        <div>
          <h2>Conference-Year Topic Leaders</h2>
          <p>Each cell shows the dominant primary topic for that venue and year, with total volume.</p>
        </div>
      </div>
      <div className="matrix" style={{ gridTemplateColumns: `118px repeat(${Math.max(years.length, 1)}, minmax(132px, 1fr))` }}>
        <div className="matrix-corner">Conference</div>
        {years.map((year) => (
          <div className="matrix-head" key={year}>
            {year}
          </div>
        ))}
        {conferences.map((conference) => (
          <div className="matrix-row" key={conference.id}>
            <div className="matrix-label">{conference.name}</div>
            {years.map((year) => {
              const cell = counts.get(`${conference.id}:${year}`) ?? { total: 0 };
              const [topTopicId, topCount = 0] = Array.from(cell.categories?.entries?.() ?? []).sort((a, b) => b[1] - a[1])[0] ?? [];
              const topic = topTopicId ? getTopic(dashboard, topTopicId) : null;
              const share = cell.total ? topCount / cell.total : 0;
              const intensity = cell.total ? 0.18 + (cell.total / max) * 0.72 : 0;
              return (
                <div
                  className={`matrix-cell ${cell.total ? '' : 'matrix-cell-empty'}`}
                  key={`${conference.id}-${year}`}
                  style={{ '--heat': intensity, '--topic-color': topic?.color ?? '#64748b' }}
                >
                  <strong>{topic?.label ?? '-'}</strong>
                  <small>
                    {cell.total ? `${formatNumber(topCount)} of ${formatNumber(cell.total)} (${percent(share)})` : 'No collected papers'}
                  </small>
                  <i style={{ width: `${cell.total ? Math.max(8, share * 100) : 0}%` }} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function YearlyMixChart({ dashboard, series, topics }) {
  const visibleTopics = topics.filter((topic) => topic.count > 0).slice(0, STACK_LIMIT);
  const visibleIds = new Set(visibleTopics.map((topic) => topic.id));
  const otherColor = '#94a3b8';

  return (
    <section className="panel yearly-mix-panel">
      <div className="panel-heading">
        <div>
          <h2>Research Mix by Year</h2>
          <p>Stacked topic shares reveal which research themes expanded or contracted each year.</p>
        </div>
      </div>
      <div className="yearly-mix">
        {series.map((yearItem) => {
          const segments = visibleTopics.map((topic) => ({
            ...topic,
            ...(yearItem.categories[topic.id] ?? { count: 0, share: 0 }),
          }));
          const otherCount = dashboard.summary.categories.reduce((sum, topic) => {
            if (visibleIds.has(topic.id)) return sum;
            return sum + (yearItem.categories[topic.id]?.count ?? 0);
          }, 0);
          const otherShare = yearItem.total ? otherCount / yearItem.total : 0;
          const leader = segments.sort((a, b) => b.count - a.count)[0];

          return (
            <div className="year-mix-row" key={yearItem.year}>
              <div className="year-mix-label">
                <strong>{yearItem.year}</strong>
                <small>{formatNumber(yearItem.total)} papers</small>
              </div>
              <div className="stack-bar" aria-label={`${yearItem.year} topic mix`}>
                {segments.map((segment) => (
                  <span
                    key={segment.id}
                    title={`${segment.label}: ${formatNumber(segment.count)} (${percent(segment.share)})`}
                    style={{
                      width: `${segment.share * 100}%`,
                      background: segment.color,
                    }}
                  />
                ))}
                {otherShare > 0 && (
                  <span
                    title={`Other topics: ${formatNumber(otherCount)} (${percent(otherShare)})`}
                    style={{ width: `${otherShare * 100}%`, background: otherColor }}
                  />
                )}
              </div>
              <div className="year-mix-leader">
                <span className="dot" style={{ background: leader?.color ?? otherColor }} />
                <strong>{leader?.label ?? 'No data'}</strong>
                <small>{percent(leader?.share ?? 0)}</small>
              </div>
            </div>
          );
        })}
      </div>
      <div className="legend">
        {visibleTopics.map((topic) => (
          <span key={topic.id}>
            <i style={{ background: topic.color }} />
            {topic.label}
          </span>
        ))}
        <span>
          <i style={{ background: otherColor }} />
          Other
        </span>
      </div>
    </section>
  );
}

function ConferenceFingerprints({ dashboard, papers, conferences, globalTopics }) {
  const globalShare = new Map(globalTopics.map((topic) => [topic.id, topic.share]));

  return (
    <section className="panel fingerprint-panel">
      <div className="panel-heading">
        <div>
          <h2>Conference Topic Fingerprints</h2>
          <p>Top topics per venue, plus lift versus the selected corpus average.</p>
        </div>
      </div>
      <div className="fingerprint-list">
        {conferences.map((conference) => {
          const conferencePapers = papers.filter((paper) => paper.conference === conference.id);
          const summary = summarizeTopicSet(dashboard, conferencePapers);
          const top = summary.topics.filter((topic) => topic.count > 0).slice(0, 4);
          const leader = top[0];
          const lift = leader?.share && globalShare.get(leader.id) ? leader.share / globalShare.get(leader.id) : 0;

          return (
            <div className="fingerprint-row" key={conference.id}>
              <div className="fingerprint-title">
                <strong>{conference.name}</strong>
                <small>{formatNumber(summary.total)} papers</small>
              </div>
              <div className="fingerprint-bars">
                {top.map((topic) => (
                  <div className="mini-topic-row" key={topic.id}>
                    <span className="dot" style={{ background: topic.color }} />
                    <span>{topic.label}</span>
                    <div className="mini-track">
                      <i style={{ width: `${Math.max(4, topic.share * 100)}%`, background: topic.color }} />
                    </div>
                    <b>{percent(topic.share)}</b>
                  </div>
                ))}
              </div>
              <div className="lift-badge" style={{ '--topic-color': leader?.color ?? '#64748b' }}>
                <span>{leader?.label ?? 'No data'}</span>
                <strong>{lift ? `${lift.toFixed(1)}x lift` : '-'}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TrendChart({ series, topics }) {
  const selected = topics.filter((topic) => topic.count > 0).slice(0, TREND_LIMIT);
  const width = 720;
  const height = 250;
  const padding = { top: 20, right: 30, bottom: 34, left: 50 };
  const years = series.map((item) => item.year);
  const maxSelectedShare = Math.max(
    ...selected.flatMap((topic) => series.map((yearItem) => yearItem.categories?.[topic.id]?.share ?? 0)),
    0.04,
  );
  const yMax = Math.min(1, Math.max(0.05, Math.ceil((maxSelectedShare + 0.015) * 20) / 20));
  const ticks = [0, yMax / 2, yMax];
  const xStep = years.length > 1 ? (width - padding.left - padding.right) / (years.length - 1) : 0;
  const x = (index) => padding.left + (years.length > 1 ? index * xStep : (width - padding.left - padding.right) / 2);
  const y = (share) => padding.top + (1 - Math.min(share / yMax, 1)) * (height - padding.top - padding.bottom);

  return (
    <section className="panel trend-panel">
      <div className="panel-heading">
        <div>
          <h2>Topic Share Over Time</h2>
          <p>Filtered yearly shares use a dynamic scale so small but important shifts remain visible.</p>
        </div>
      </div>
      <svg className="trend-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Topic share trend chart">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={padding.left} y1={y(tick)} x2={width - padding.right} y2={y(tick)} />
            <text x={12} y={y(tick) + 4}>
              {percent(tick)}
            </text>
          </g>
        ))}
        {years.map((year, index) => (
          <text key={year} x={x(index)} y={height - 10} textAnchor="middle">
            {year}
          </text>
        ))}
        {selected.map((topic) => {
          const points = series.map((yearItem, index) => {
            const share = yearItem.categories?.[topic.id]?.share ?? 0;
            return `${x(index)},${y(share)}`;
          });
          return (
            <g key={topic.id}>
              <polyline
                points={points.join(' ')}
                fill="none"
                stroke={topic.color}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {series.map((yearItem, index) => {
                const share = yearItem.categories?.[topic.id]?.share ?? 0;
                return <circle key={`${topic.id}-${yearItem.year}`} cx={x(index)} cy={y(share)} r="3.5" fill={topic.color} />;
              })}
            </g>
          );
        })}
      </svg>
      <div className="legend">
        {selected.map((topic) => (
          <span key={topic.id}>
            <i style={{ background: topic.color }} />
            {topic.label} <b>{percent(series.at(-1)?.categories?.[topic.id]?.share ?? 0)}</b>
          </span>
        ))}
      </div>
    </section>
  );
}

function InsightRail({ dashboard, papers, categoryTotals, momentum, latestYear }) {
  const collected = dashboard.summary.sourceCoverage.filter((source) => source.status === 'ok');
  const pending = dashboard.summary.sourceCoverage.filter((source) => source.status !== 'ok');
  const conferenceCoverage = computeConferenceCoverage(dashboard);
  const rising = momentum.filter((item) => item.delta > 0).slice(0, 5);
  const falling = [...momentum].filter((item) => item.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 4);
  const topThreeShare = categoryTotals.slice(0, 3).reduce((sum, topic) => sum + topic.share, 0);

  return (
    <aside className="insight-rail">
      <section className="panel">
        <div className="panel-heading compact">
          <h2>Rising Topics</h2>
        </div>
        <div className="momentum-list">
          {rising.length ? (
            rising.map((item) => (
              <div key={item.id} className="momentum-row">
                <span className="dot" style={{ background: item.color }} />
                <div>
                  <strong>{item.label}</strong>
                  <small>
                    {percentagePoints(item.delta)} from {item.baselineYear ?? '-'} to {item.recentYear ?? '-'}
                  </small>
                </div>
                <b>{formatNumber(item.recentCount)}</b>
              </div>
            ))
          ) : (
            <p className="empty-note">Select at least two populated years to see momentum.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading compact">
          <h2>Cooling Topics</h2>
        </div>
        <div className="momentum-list">
          {falling.length ? (
            falling.map((item) => (
              <div key={item.id} className="momentum-row">
                <span className="dot" style={{ background: item.color }} />
                <div>
                  <strong>{item.label}</strong>
                  <small>
                    {percentagePoints(item.delta)} from {item.baselineYear ?? '-'} to {item.recentYear ?? '-'}
                  </small>
                </div>
                <b>{formatNumber(item.recentCount)}</b>
              </div>
            ))
          ) : (
            <p className="empty-note">No declining topic share in the selected range.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading compact">
          <h2>Topic Concentration</h2>
        </div>
        <div className="concentration-meter">
          <span style={{ width: `${Math.min(100, topThreeShare * 100)}%` }} />
        </div>
        <div className="concentration-copy">
          <strong>{percent(topThreeShare)}</strong>
          <span>of selected papers are in the top 3 topics.</span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading compact">
          <h2>Data Freshness</h2>
        </div>
        <div className="coverage">
          <div>
            <strong>{collected.length}</strong>
            <span>collected source-years</span>
          </div>
          <div>
            <strong>{pending.length}</strong>
            <span>pending or empty</span>
          </div>
        </div>
        <p className="freshness-note">Latest selected year: {latestYear ?? '-'} · Generated {formatDate(dashboard.generatedAt)}</p>
        <div className="conference-coverage-list">
          {conferenceCoverage.map((source) => (
            <a href={source.url} target="_blank" rel="noreferrer" key={source.id}>
              <span>{source.name}</span>
              <strong>
                {source.collected}/{source.total} years
              </strong>
              <small>
                latest {source.latestCollectedYear ?? '-'} · {source.latestYear ? `${source.latestYear} ${source.latestStatus}` : source.latestStatus}
              </small>
            </a>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading compact">
          <h2>Top Category</h2>
        </div>
        <div className="top-topic" style={{ '--topic-color': categoryTotals[0]?.color ?? '#64748b' }}>
          <strong>{categoryTotals[0]?.label ?? 'No data'}</strong>
          <span>
            {formatNumber(categoryTotals[0]?.count ?? 0)} papers · {percent(categoryTotals[0]?.share ?? 0)} of current view
          </span>
        </div>
      </section>
    </aside>
  );
}

function PaperTable({ dashboard, papers }) {
  const [sort, setSort] = useState('year-desc');
  const sorted = useMemo(() => {
    const list = [...papers];
    if (sort === 'title') list.sort((a, b) => cleanPaperTitle(a.title).localeCompare(cleanPaperTitle(b.title)));
    if (sort === 'category') list.sort((a, b) => getTopic(dashboard, a.primaryCategory).label.localeCompare(getTopic(dashboard, b.primaryCategory).label));
    if (sort === 'year-desc') list.sort((a, b) => b.year - a.year || a.conferenceName.localeCompare(b.conferenceName));
    if (sort === 'conference') list.sort((a, b) => a.conferenceName.localeCompare(b.conferenceName) || b.year - a.year);
    return list;
  }, [dashboard, papers, sort]);

  return (
    <section className="panel paper-panel">
      <div className="panel-heading">
        <div>
          <h2>Accepted Paper List</h2>
          <p>Every row is tied back to the source paper page. Math markup is normalized for readability.</p>
        </div>
        <select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="year-desc">Newest first</option>
          <option value="conference">Conference</option>
          <option value="category">Category</option>
          <option value="title">Title</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Paper</th>
              <th>Conf</th>
              <th>Year</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 260).map((paper) => {
              const topic = getTopic(dashboard, paper.primaryCategory);
              const displayTitle = cleanPaperTitle(paper.title);
              return (
                <tr key={`${paper.source}-${paper.id}`}>
                  <td>
                    <a href={paper.url} target="_blank" rel="noreferrer" title={paper.title}>
                      {displayTitle}
                    </a>
                    <small>{paper.authors.slice(0, 4).join(', ')}</small>
                  </td>
                  <td>{paper.conferenceName}</td>
                  <td>{paper.year}</td>
                  <td>
                    <span className="topic-pill" style={{ '--topic-color': topic.color }}>
                      {topic.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="table-note">
        Showing {formatNumber(Math.min(sorted.length, 260))} of {formatNumber(sorted.length)} filtered papers.
      </div>
    </section>
  );
}

export default function App() {
  const { dashboard, loading, error } = useDashboard();
  const [filters, setFilters] = useState(() => normalizeFilters(fallbackDashboard));

  useEffect(() => {
    setFilters(normalizeFilters(dashboard));
  }, [dashboard]);

  const filteredPapers = useMemo(() => getFilteredPapers(dashboard, filters), [dashboard, filters]);
  const categoryTotals = useMemo(() => computeCategoryTotals(dashboard, filteredPapers), [dashboard, filteredPapers]);
  const activeYears = useMemo(() => getActiveYears(dashboard, filters), [dashboard, filters]);
  const activeConferences = useMemo(() => getActiveConferences(dashboard, filters), [dashboard, filters]);
  const yearlySeries = useMemo(() => computeYearlyTopicSeries(dashboard, filteredPapers, activeYears), [dashboard, filteredPapers, activeYears]);
  const topicMomentum = useMemo(() => computeTopicMomentum(dashboard, yearlySeries), [dashboard, yearlySeries]);
  const latestYear = Math.max(...activeYears);
  const latestYearCount = filteredPapers.filter((paper) => paper.year === latestYear).length;
  const fastestRiser = topicMomentum.find((topic) => topic.delta > 0);
  const topTopic = categoryTotals.find((topic) => topic.count > 0);
  const topThreeShare = categoryTotals.slice(0, 3).reduce((sum, topic) => sum + topic.share, 0);
  return (
    <div className="app-shell">
      <Sidebar dashboard={dashboard} filters={filters} setFilters={setFilters} />
      <main>
        <Header dashboard={dashboard} loading={loading} sourceError={error} filters={filters} setFilters={setFilters} />

        <section className="stats-grid">
          <StatCard
            icon={Database}
            label="Accepted papers"
            value={formatNumber(filteredPapers.length)}
            detail={`${formatNumber(dashboard.summary.totalPapers)} in full corpus`}
          />
          <StatCard
            icon={Trophy}
            label="Top topic"
            value={topTopic?.label ?? 'No data'}
            detail={topTopic ? `${formatNumber(topTopic.count)} papers · ${percent(topTopic.share)}` : 'Adjust filters to inspect'}
          />
          <StatCard
            icon={Flame}
            label="Fastest riser"
            value={fastestRiser?.label ?? 'No change'}
            detail={fastestRiser ? `${percentagePoints(fastestRiser.delta)} share shift` : 'Needs at least two populated years'}
          />
          <StatCard
            icon={Percent}
            label="Top-3 concentration"
            value={percent(topThreeShare)}
            detail={`${formatNumber(latestYearCount)} papers in ${Number.isFinite(latestYear) ? latestYear : '-'}`}
          />
        </section>

        <div className="workspace-grid">
          <div className="primary-stack">
            <YearlyMixChart dashboard={dashboard} series={yearlySeries} topics={categoryTotals} />
            <TrendChart series={yearlySeries} topics={categoryTotals} />
            <ConferenceYearLeaders dashboard={dashboard} papers={filteredPapers} conferences={activeConferences} years={activeYears} />
            <TopicBars topics={categoryTotals} total={filteredPapers.length} />
            <ConferenceFingerprints dashboard={dashboard} papers={filteredPapers} conferences={activeConferences} globalTopics={categoryTotals} />
            <PaperTable dashboard={dashboard} papers={filteredPapers} />
          </div>
          <InsightRail
            dashboard={dashboard}
            papers={filteredPapers}
            categoryTotals={categoryTotals}
            momentum={topicMomentum}
            latestYear={Number.isFinite(latestYear) ? latestYear : null}
          />
        </div>
      </main>
    </div>
  );
}
