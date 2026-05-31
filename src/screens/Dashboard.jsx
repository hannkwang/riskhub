import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Clock, CheckCircle,
  ArrowUpDown, Filter, Download, Plus, ChevronRight, CalendarClock,
} from 'lucide-react';
import { api } from '../lib/api';
import { Badge, RiskBadge, StageBadge, Avatar, Button, Card, KpiCard, PageHeader, Select } from '../components/ui';

const STAGE_ORDER = ['Draft','Biz Owner','Cyber Review','Governance','Approved','Rejected'];

function daysUntil(isoDate) {
  if (!isoDate) return null;
  const diff = new Date(isoDate) - new Date(new Date().toDateString());
  return Math.ceil(diff / 86400000);
}

function ExpiryChip({ expiresAt }) {
  const days = daysUntil(expiresAt);
  if (days === null) return null;
  if (days <= 31) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">
        <CalendarClock size={11} /> {days}d left
      </span>
    );
  }
  if (days <= 90) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full whitespace-nowrap">
        <CalendarClock size={11} /> {days}d left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">
      <CalendarClock size={11} /> {days}d left
    </span>
  );
}

export default function Dashboard() {
  const [risks, setRisks]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filterLevel, setFilterLevel]   = useState('');
  const [filterStage, setFilterStage]   = useState('');
  const [filterOwner, setFilterOwner]   = useState('');
  const [sortCol, setSortCol]           = useState('updated_at');
  const [sortAsc, setSortAsc]           = useState(false);
  const [activeKpi, setActiveKpi]       = useState(null);

  useEffect(() => {
    api.getRisks()
      .then(setRisks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const owners = [...new Set(risks.map((r) => r.owner).filter(Boolean))];
  const expiringSoon = risks.filter(r => { const d = daysUntil(r.expiresAt); return d !== null && d <= 90; });
  const openRisks = risks.filter(r => r.stage !== 'Approved' && r.stage !== 'Rejected');
  const highRisks = risks.filter(r => r.level === 'High');
  const awaitingCyber = risks.filter(r => r.stage === 'Cyber Review');

  const filtered = risks
    .filter((r) => {
      if (filterLevel && r.level !== filterLevel) return false;
      if (filterStage && r.stage !== filterStage) return false;
      if (filterOwner && r.owner !== filterOwner) return false;
      if (activeKpi === 'awaiting')  return r.stage === 'Cyber Review';
      if (activeKpi === 'high')      return r.level === 'High';
      if (activeKpi === 'expiring')  return daysUntil(r.expiresAt) !== null && daysUntil(r.expiresAt) <= 90;
      return true;
    })
    .sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (!av && !bv) return 0;
      if (!av) return sortAsc ? -1 : 1;
      if (!bv) return sortAsc ? 1 : -1;
      if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

  function toggleSort(col) {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  }

  function SortHeader({ col, children }) {
    const active = sortCol === col;
    return (
      <button
        onClick={() => toggleSort(col)}
        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider hover:text-slate-900 transition-colors ${active ? 'text-blue-700' : 'text-slate-500'}`}
      >
        {children}
        <ArrowUpDown size={11} className={active ? 'text-blue-500' : 'text-slate-300'} />
      </button>
    );
  }

  return (
    <>
      <PageHeader
        title="Risk Dashboard"
        subtitle="All risk assessments across teams"
        actions={
          <>
            <Button variant="secondary" size="sm">
              <Download size={14} /> Export
            </Button>
            <Link to="/new">
              <Button size="sm">
                <Plus size={14} /> New Risk
              </Button>
            </Link>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard
          label="Awaiting Cyber review"
          value={awaitingCyber.length}
          sub="In Cyber Review stage"
          icon={Clock}
          accent
          onClick={() => setActiveKpi(activeKpi === 'awaiting' ? null : 'awaiting')}
        />
        <KpiCard
          label="Open risks"
          value={openRisks.length}
          sub="Across all stages"
          icon={AlertTriangle}
        />
        <KpiCard
          label="High risk items"
          value={highRisks.length}
          sub="Require prioritisation"
          icon={AlertTriangle}
          onClick={() => setActiveKpi(activeKpi === 'high' ? null : 'high')}
        />
        <KpiCard
          label="Approved"
          value={risks.filter(r => r.stage === 'Approved').length}
          sub="Total approved"
          icon={CheckCircle}
        />
        <KpiCard
          label="Expiring soon"
          value={expiringSoon.length}
          sub="Within 90 days"
          icon={CalendarClock}
          onClick={() => setActiveKpi(activeKpi === 'expiring' ? null : 'expiring')}
        />
      </div>

      {activeKpi && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-slate-600">Filtering by:</span>
          <Badge variant="primary" size="md" className="flex items-center gap-1">
            {activeKpi === 'awaiting' ? 'Awaiting Cyber review' : activeKpi === 'expiring' ? 'Expiring soon' : 'High risk'}
            <button onClick={() => setActiveKpi(null)} className="ml-1 hover:text-blue-900">✕</button>
          </Badge>
        </div>
      )}

      <Card padding={false}>
        <div className="flex items-center gap-3 p-4 border-b border-slate-200 flex-wrap">
          <Filter size={15} className="text-slate-400 flex-shrink-0" />
          <Select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}>
            <option value="">All risk levels</option>
            <option>High</option><option>Medium</option><option>Low</option>
          </Select>
          <Select value={filterStage} onChange={(e) => setFilterStage(e.target.value)}>
            <option value="">All stages</option>
            {STAGE_ORDER.map((s) => <option key={s}>{s}</option>)}
          </Select>
          <Select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}>
            <option value="">All owners</option>
            {owners.map((o) => <option key={o}>{o}</option>)}
          </Select>
          <span className="ml-auto text-xs text-slate-400">{filtered.length} of {risks.length} risks</span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">Loading risks…</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 w-32"><SortHeader col="id">Risk ID</SortHeader></th>
                  <th className="text-left px-4 py-3"><SortHeader col="title">Risk Statement</SortHeader></th>
                  <th className="text-left px-4 py-3 w-40 hidden md:table-cell"><SortHeader col="owner">Owner</SortHeader></th>
                  <th className="text-center px-3 py-3 w-16 hidden lg:table-cell"><SortHeader col="impact">Imp.</SortHeader></th>
                  <th className="text-center px-3 py-3 w-16 hidden lg:table-cell"><SortHeader col="likelihood">Lik.</SortHeader></th>
                  <th className="text-center px-4 py-3 w-24"><SortHeader col="level">Level</SortHeader></th>
                  <th className="text-left px-4 py-3 w-36 hidden sm:table-cell"><SortHeader col="stage">Stage</SortHeader></th>
                  <th className="text-right px-4 py-3 w-24 hidden md:table-cell"><SortHeader col="updated_at">Updated</SortHeader></th>
                  <th className="text-left px-4 py-3 w-28 hidden xl:table-cell text-xs font-semibold text-slate-500 uppercase tracking-wider">Expires</th>
                  <th className="w-10 px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-500 font-medium">{r.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/risk/${r.id}`} className="text-sm font-medium text-slate-800 hover:text-blue-700 transition-colors line-clamp-2">
                        {r.title}
                      </Link>
                      <div className="text-xs text-slate-400 mt-0.5">{r.system}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <Avatar initials={r.owner ? r.owner.split(' ').map(p=>p[0]).join('') : '?'} size="xs" />
                        <span className="text-sm text-slate-600 truncate max-w-[120px]">{r.owner}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center hidden lg:table-cell">
                      <span className="text-sm font-semibold text-slate-700">{r.impact}</span>
                    </td>
                    <td className="px-3 py-3 text-center hidden lg:table-cell">
                      <span className="text-sm font-semibold text-slate-700">{r.likelihood}</span>
                    </td>
                    <td className="px-4 py-3 text-center"><RiskBadge level={r.level} /></td>
                    <td className="px-4 py-3 hidden sm:table-cell"><StageBadge stage={r.stage} /></td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <span className="text-xs text-slate-400">{r.updated}</span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {r.expiresAt ? <ExpiryChip expiresAt={r.expiresAt} /> : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <Link to={`/risk/${r.id}`} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 inline-flex opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight size={15} />
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <div className="text-sm text-slate-400">No risks match the current filters.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
          <span className="text-xs text-slate-400">Showing {filtered.length} of {risks.length} risks</span>
        </div>
      </Card>
    </>
  );
}
