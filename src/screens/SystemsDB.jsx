import { useState, useEffect } from 'react';
import { Search, Globe, Lock, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import { Badge, Card, PageHeader } from '../components/ui';

const CRIT_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const CRIT_STYLE = {
  Critical: 'bg-red-50 text-red-700 border-red-200',
  High:     'bg-orange-50 text-orange-700 border-orange-200',
  Medium:   'bg-amber-50 text-amber-700 border-amber-200',
  Low:      'bg-slate-50 text-slate-500 border-slate-200',
};
const SENS_STYLE = {
  Restricted:   'bg-purple-50 text-purple-700 border-purple-200',
  Confidential: 'bg-blue-50 text-blue-700 border-blue-200',
  Internal:     'bg-slate-50 text-slate-500 border-slate-200',
};
const RML_STYLE = {
  High:   'bg-red-50 text-red-700 border-red-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low:    'bg-slate-50 text-slate-500 border-slate-200',
};

function CritBadge({ level }) {
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${CRIT_STYLE[level] || ''}`}>
      {level}
    </span>
  );
}

function SensBadge({ level }) {
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${SENS_STYLE[level] || ''}`}>
      {level}
    </span>
  );
}

function RMLBadge({ level }) {
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${RML_STYLE[level] || 'bg-slate-50 text-slate-400 border-slate-200'}`}>
      {level || '—'}
    </span>
  );
}

function OpenRAsCell({ count }) {
  if (count === 0) return <span className="text-slate-300 text-sm">—</span>;
  const color = count >= 4 ? 'text-red-600 bg-red-50' : count >= 2 ? 'text-amber-600 bg-amber-50' : 'text-slate-600 bg-slate-100';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {count >= 4 && <AlertTriangle size={10} />}
      {count}
    </span>
  );
}

function SortHeader({ label, field, sort, onSort }) {
  const active = sort.field === field;
  return (
    <th
      className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-slate-700 select-none"
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          : <span className="opacity-0 group-hover:opacity-100"><ChevronDown size={12} /></span>}
      </span>
    </th>
  );
}

export default function SystemsDB() {
  const [SYSTEMS, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [critFilter, setCritFilter] = useState('all');
  const [inetFilter, setInetFilter] = useState('all');
  const [sort, setSort] = useState({ field: 'crit', dir: 'asc' });

  useEffect(() => {
    api.getSystems()
      .then(rows => setSystems(rows.map(s => ({
        ...s,
        crit: s.criticality,
        sens: s.sensitivity,
        inet: s.internet_facing,
      }))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function toggleSort(field) {
    setSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' });
  }

  const crits = ['all', 'Critical', 'High', 'Medium', 'Low'];

  const filtered = SYSTEMS
    .filter(s => {
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.owner.toLowerCase().includes(search.toLowerCase()) || s.team.toLowerCase().includes(search.toLowerCase());
      const matchCrit = critFilter === 'all' || s.crit === critFilter;
      const matchInet = inetFilter === 'all' || (inetFilter === 'yes' ? s.inet : !s.inet);
      return matchSearch && matchCrit && matchInet;
    })
    .sort((a, b) => {
      let av, bv;
      if (sort.field === 'crit') { av = CRIT_ORDER[a.crit]; bv = CRIT_ORDER[b.crit]; }
      else if (sort.field === 'openRAs') { av = a.openRAs; bv = b.openRAs; }
      else if (sort.field === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else { av = 0; bv = 0; }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });

  const totalRAs = SYSTEMS.reduce((s, x) => s + x.openRAs, 0);
  const internetCount = SYSTEMS.filter(s => s.inet).length;
  const highCrit = SYSTEMS.filter(s => s.crit === 'Critical' || s.crit === 'High').length;

  return (
    <>
      <PageHeader
        title="Systems Database"
        subtitle={`Last synced: today, 07:00 · ${SYSTEMS.length} systems registered`}
        actions={
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> In sync with CMDB
          </div>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total systems',          value: SYSTEMS.length,  accent: false },
          { label: 'Critical or High',       value: highCrit,        accent: false },
          { label: 'Internet-facing',        value: internetCount,   accent: true  },
          { label: 'Open risk assessments',  value: totalRAs,        accent: true  },
        ].map(({ label, value, accent }) => (
          <Card key={label} className="text-center">
            <div className={`text-2xl font-bold ${accent ? 'text-blue-700' : 'text-slate-800'} mb-0.5`}>{value}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search systems, owners, teams…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {crits.map(c => (
            <button
              key={c}
              onClick={() => setCritFilter(c)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                critFilter === c ? 'bg-blue-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {c === 'all' ? 'All criticality' : c}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {[
            { key: 'all', label: 'All' },
            { key: 'yes', label: <span className="flex items-center gap-1"><Globe size={11} /> Internet-facing</span> },
            { key: 'no',  label: <span className="flex items-center gap-1"><Lock size={11} /> Internal only</span> },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setInetFilter(key)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                inetFilter === key ? 'bg-blue-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <SortHeader label="System" field="name" sort={sort} onSort={toggleSort} />
                <SortHeader label="Criticality" field="crit" sort={sort} onSort={toggleSort} />
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">RML</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Sensitivity</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Internet-facing</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Owner</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Team</th>
                <SortHeader label="Open RAs" field="openRAs" sort={sort} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-slate-400">No systems match your filters.</td>
                </tr>
              )}
              {filtered.map(s => (
                <tr key={s.name} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5">
                    <span className="font-medium text-slate-900">{s.name}</span>
                  </td>
                  <td className="px-4 py-3.5"><CritBadge level={s.crit} /></td>
                  <td className="px-4 py-3.5"><RMLBadge level={s.rml} /></td>
                  <td className="px-4 py-3.5 hidden sm:table-cell"><SensBadge level={s.sens} /></td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    {s.inet
                      ? <span className="inline-flex items-center gap-1 text-xs text-blue-600"><Globe size={12} /> Yes</span>
                      : <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Lock size={12} /> No</span>}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 hidden md:table-cell">{s.owner}</td>
                  <td className="px-4 py-3.5 text-slate-500 hidden lg:table-cell">{s.team}</td>
                  <td className="px-4 py-3.5"><OpenRAsCell count={s.openRAs} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Internet-facing callout */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3 text-sm">
        <Globe size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-blue-800">
          <strong>{internetCount} internet-facing systems</strong> are subject to the Likelihood floor policy (BP-042). All risk assessments for these systems must apply a minimum Likelihood score of 3.
        </div>
      </div>
    </>
  );
}
