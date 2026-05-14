import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownUp,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Database,
  Filter,
  Github,
  RefreshCcw,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { fallbackDashboard } from './fallbackDashboard.js';

const CATEGORY_LIMIT = 10;

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value ?? 0);
}

function percent(value, digits = 1) {
  return `${((value ?? 0) * 100).toFixed(digits)}%`;
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

function normalizeFilters(dashboard) {
  return {
    conferences: new Set(dashboard.summary.conferences.map((conference) => conference.id)),
    years: new Set(dashboard.summary.years),
    tracks: new Set(['main', 'findings']),
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
          <ArrowDownUp size={16} />
          Track
        </div>
        <div className="track-toggle">
          <ToggleButton active={filters.tracks.has('main')} onClick={() => toggleSet('tracks', 'main')}>
            Main
          </ToggleButton>
          <ToggleButton active={filters.tracks.has('findings')} onClick={() => toggleSet('tracks', 'findings')}>
            Findings
          </ToggleButton>
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
    if (!filters.tracks.has(paper.track)) return false;
    if (filters.category !== 'all' && !paper.categories.includes(filters.category)) return false;
    if (!query) return true;
    const haystack = `${paper.title} ${paper.authors.join(' ')} ${(paper.keywords ?? []).join(' ')}`.toLowerCase();
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

function TopicBars({ topics, total }) {
  const top = topics.filter((topic) => topic.count > 0).slice(0, CATEGORY_LIMIT);
  const max = Math.max(...top.map((topic) => topic.count), 1);

  return (
    <section className="panel topic-bars">
      <div className="panel-heading">
        <div>
          <h2>Popular Topic Categories</h2>
          <p>Primary category assigned from title, abstract, and keywords.</p>
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

function Matrix({ dashboard, papers }) {
  const counts = useMemo(() => {
    const map = new Map();
    for (const paper of papers) {
      const key = `${paper.conference}:${paper.year}`;
      const current = map.get(key) ?? { total: 0, main: 0, findings: 0 };
      current.total += 1;
      current[paper.track] = (current[paper.track] ?? 0) + 1;
      map.set(key, current);
    }
    return map;
  }, [papers]);

  const max = Math.max(...Array.from(counts.values()).map((item) => item.total), 1);

  return (
    <section className="panel matrix-panel">
      <div className="panel-heading">
        <div>
          <h2>Conference-Year Coverage</h2>
          <p>Main and Findings counts update with filters.</p>
        </div>
      </div>
      <div className="matrix" style={{ gridTemplateColumns: `128px repeat(${dashboard.summary.years.length}, minmax(84px, 1fr))` }}>
        <div className="matrix-corner">Conference</div>
        {dashboard.summary.years.map((year) => (
          <div className="matrix-head" key={year}>
            {year}
          </div>
        ))}
        {dashboard.summary.conferences.map((conference) => (
          <div className="matrix-row" key={conference.id}>
            <div className="matrix-label">{conference.name}</div>
            {dashboard.summary.years.map((year) => {
              const cell = counts.get(`${conference.id}:${year}`) ?? { total: 0, main: 0, findings: 0 };
              const intensity = cell.total ? 0.18 + (cell.total / max) * 0.72 : 0;
              return (
                <div className="matrix-cell" key={`${conference.id}-${year}`} style={{ '--heat': intensity }}>
                  <strong>{cell.total ? formatNumber(cell.total) : '-'}</strong>
                  <small>
                    M {cell.main ?? 0}
                    {cell.findings ? ` / F ${cell.findings}` : ''}
                  </small>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function TrendChart({ dashboard, topics }) {
  const selected = topics.filter((topic) => topic.count > 0).slice(0, 5);
  const width = 720;
  const height = 250;
  const padding = { top: 20, right: 24, bottom: 34, left: 46 };
  const years = dashboard.summary.yearlyTopicSeries.map((item) => item.year);
  const xStep = years.length > 1 ? (width - padding.left - padding.right) / (years.length - 1) : 0;
  const x = (index) => padding.left + index * xStep;
  const y = (share) => padding.top + (1 - share) * (height - padding.top - padding.bottom);

  return (
    <section className="panel trend-panel">
      <div className="panel-heading">
        <div>
          <h2>Topic Share Over Time</h2>
          <p>Top categories by filtered result, plotted by yearly share.</p>
        </div>
      </div>
      <svg className="trend-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Topic share trend chart">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line x1={padding.left} y1={y(tick)} x2={width - padding.right} y2={y(tick)} />
            <text x={12} y={y(tick) + 4}>
              {percent(tick, 0)}
            </text>
          </g>
        ))}
        {years.map((year, index) => (
          <text key={year} x={x(index)} y={height - 10} textAnchor="middle">
            {year}
          </text>
        ))}
        {selected.map((topic) => {
          const points = dashboard.summary.yearlyTopicSeries.map((yearItem, index) => {
            const share = yearItem.categories?.[topic.id]?.share ?? 0;
            return `${x(index)},${y(share)}`;
          });
          return (
            <polyline
              key={topic.id}
              points={points.join(' ')}
              fill="none"
              stroke={topic.color}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="legend">
        {selected.map((topic) => (
          <span key={topic.id}>
            <i style={{ background: topic.color }} />
            {topic.label}
          </span>
        ))}
      </div>
    </section>
  );
}

function InsightRail({ dashboard, papers, categoryTotals }) {
  const mainCount = papers.filter((paper) => paper.track === 'main').length;
  const findingsCount = papers.filter((paper) => paper.track === 'findings').length;
  const collected = dashboard.summary.sourceCoverage.filter((source) => source.status === 'ok');
  const pending = dashboard.summary.sourceCoverage.filter((source) => source.status !== 'ok');

  return (
    <aside className="insight-rail">
      <section className="panel">
        <div className="panel-heading compact">
          <h2>Emerging Topics</h2>
        </div>
        <div className="momentum-list">
          {dashboard.summary.momentum.slice(0, 6).map((item) => (
            <div key={item.id} className="momentum-row">
              <span className="dot" style={{ background: item.color }} />
              <div>
                <strong>{item.label}</strong>
                <small>
                  {item.delta >= 0 ? '+' : ''}
                  {percent(item.delta)} share change
                </small>
              </div>
              <b>{formatNumber(item.recentCount)}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="panel split-card">
        <div className="panel-heading compact">
          <h2>Main vs Findings</h2>
        </div>
        <div className="split-meter">
          <span style={{ width: `${papers.length ? (mainCount / papers.length) * 100 : 0}%` }} />
        </div>
        <div className="split-values">
          <strong>Main {formatNumber(mainCount)}</strong>
          <strong>Findings {formatNumber(findingsCount)}</strong>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading compact">
          <h2>Source Coverage</h2>
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
        <div className="source-list">
          {dashboard.summary.sourceCoverage.slice(0, 8).map((source) => (
            <a href={source.url} target="_blank" rel="noreferrer" key={`${source.conference}-${source.year}`}>
              <span>{source.conferenceName} {source.year}</span>
              <small>{source.displayStatus}</small>
            </a>
          ))}
        </div>
      </section>

      <section className="panel command-card">
        <div className="panel-heading compact">
          <h2>Refresh Command</h2>
        </div>
        <code>npm run data:update</code>
        <p>Scheduled GitHub Actions can run the same command and commit changed JSON.</p>
      </section>

      <section className="panel">
        <div className="panel-heading compact">
          <h2>Top Category</h2>
        </div>
        <div className="top-topic" style={{ '--topic-color': categoryTotals[0]?.color ?? '#64748b' }}>
          <strong>{categoryTotals[0]?.label ?? 'No data'}</strong>
          <span>{formatNumber(categoryTotals[0]?.count ?? 0)} papers in current view</span>
        </div>
      </section>
    </aside>
  );
}

function PaperTable({ dashboard, papers }) {
  const [sort, setSort] = useState('year-desc');
  const sorted = useMemo(() => {
    const list = [...papers];
    if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title));
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
          <p>Every row is tied back to the source paper page.</p>
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
              <th>Track</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 260).map((paper) => {
              const topic = getTopic(dashboard, paper.primaryCategory);
              return (
                <tr key={`${paper.source}-${paper.id}`}>
                  <td>
                    <a href={paper.url} target="_blank" rel="noreferrer">
                      {paper.title}
                    </a>
                    <small>{paper.authors.slice(0, 4).join(', ')}</small>
                  </td>
                  <td>{paper.conferenceName}</td>
                  <td>{paper.year}</td>
                  <td>
                    <span className={`track-pill ${paper.track}`}>{paper.trackLabel ?? paper.track}</span>
                  </td>
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
  const latestYear = Math.max(...dashboard.summary.years);
  const collectedSources = dashboard.summary.sourceCoverage.filter((source) => source.status === 'ok').length;

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
          <StatCard icon={BookOpen} label="Conferences" value={dashboard.summary.conferences.length} detail="ACL family + OpenReview venues" />
          <StatCard icon={TrendingUp} label="Latest year" value={latestYear} detail={`Generated ${formatDate(dashboard.generatedAt)}`} />
          <StatCard icon={CheckCircle2} label="Collected source-years" value={collectedSources} detail="Auto-refresh ready" />
        </section>

        <div className="workspace-grid">
          <div className="primary-stack">
            <TopicBars topics={categoryTotals} total={filteredPapers.length} />
            <Matrix dashboard={dashboard} papers={filteredPapers} />
            <TrendChart dashboard={dashboard} topics={categoryTotals} />
            <PaperTable dashboard={dashboard} papers={filteredPapers} />
          </div>
          <InsightRail dashboard={dashboard} papers={filteredPapers} categoryTotals={categoryTotals} />
        </div>
      </main>
    </div>
  );
}
