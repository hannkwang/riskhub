import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Card, Badge, RiskBadge } from '../components/ui';
import { AlertTriangle, Clock, CheckCircle, Users, RotateCcw, ChevronRight, CalendarClock } from 'lucide-react';
import { api } from '../lib/api';

function sixMonthsAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().split('T')[0];
}

const ROLE_DISPLAY = {
  security:       'Cyber Security',
  tech_governance:'Tech Governance Assurance',
  grc_chair:      'GRC Co-Chair',
  biz_owner:      'System Owner',
};

function computeLevel(score) {
  if (score >= 15) return 'High';
  if (score >= 9)  return 'Medium';
  if (score >= 4)  return 'Low';
  return 'Very Low';
}

function DaysChip({ days }) {
  if (days === null || days === undefined) return <span className="text-slate-300 text-xs">—</span>;
  const d = Math.round(days);
  const cls = d >= 7 ? 'text-red-700 bg-red-50 border-red-200'
            : d >= 3 ? 'text-amber-700 bg-amber-50 border-amber-200'
                     : 'text-emerald-700 bg-emerald-50 border-emerald-200';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      <Clock size={10} /> {d}d
    </span>
  );
}

function StatusDot({ status }) {
  if (status === 'approved')    return <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />;
  if (status === 'routed_back') return <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />;
  return <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />;
}

export default function Analytics() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [dateMode, setDateMode] = useState('6m');
  const [customDate, setCustomDate] = useState(sixMonthsAgo());

  const fromDate = dateMode === '6m' ? sixMonthsAgo() : customDate;

  useEffect(() => {
    setLoading(true);
    const params = fromDate ? { from_date: fromDate } : {};
    api.getAnalytics(params)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [fromDate]);

  const { kpi = {}, systemOwnerRisks = [], concurrentPendingByPerson = [], inFlight = [], stageTiming = [], routeBacksByPerson = [] } = data || {};

  const kpiCards = [
    { label: 'Open risk acceptances', value: kpi.totalOpen ?? 0,      icon: Clock,         accent: kpi.totalOpen > 0 },
    { label: 'Awaiting System Owner',  value: kpi.inSystemOwner ?? 0,  icon: Users,         accent: false },
    { label: 'In Concurrent Review',   value: kpi.inConcurrent ?? 0,   icon: Users,         accent: false },
    { label: 'Stuck >7 days',          value: kpi.stuckCount ?? 0,     icon: AlertTriangle, accent: false, danger: (kpi.stuckCount ?? 0) > 0 },
    { label: 'Total approved',         value: kpi.approved ?? 0,       icon: CheckCircle,   accent: false },
  ];

  return (
    <>
      <PageHeader
        title="Approval Status & Timelines"
        subtitle={`${kpi.totalOpen ?? 0} open · ${kpi.approved ?? 0} approved of ${kpi.totalRisks ?? 0} total`}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button onClick={() => setDateMode('6m')}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors ${dateMode === '6m' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <CalendarClock size={12} /> Past 6 months
              </button>
              <button onClick={() => setDateMode('custom')}
                className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors ${dateMode === 'custom' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                Custom
              </button>
            </div>
            {dateMode === 'custom' && (
              <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
          </div>
        }
      />

      <div className={`transition-opacity ${loading ? 'opacity-40 pointer-events-none' : ''}`}>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {kpiCards.map((k, i) => (
          <Card key={i} className={`!p-4 ${k.accent ? 'bg-blue-700 border-blue-600' : ''}`}>
            <div className={`text-2xl font-bold mb-1 ${k.danger ? 'text-red-600' : k.accent ? 'text-white' : 'text-slate-900'}`}>
              {k.value}
            </div>
            <div className={`text-sm font-medium leading-tight ${k.accent ? 'text-blue-100' : 'text-slate-700'}`}>{k.label}</div>
          </Card>
        ))}
      </div>

      {/* Pending by reviewer + stage timing */}
      <div className="grid lg:grid-cols-2 gap-5 mb-5">

        {/* Pending per concurrent reviewer */}
        <Card padding={false}>
          <div className="px-5 pt-5 pb-3 border-b border-slate-200">
            <div className="font-semibold text-slate-800">Pending approvals by reviewer</div>
            <p className="text-xs text-slate-500 mt-0.5">Concurrent review — items still awaiting each person's action</p>
          </div>
          {concurrentPendingByPerson.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <CheckCircle size={28} className="text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No pending concurrent approvals.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-2.5">Reviewer</th>
                  <th className="text-left px-3 py-2.5 hidden sm:table-cell">Team</th>
                  <th className="text-center px-3 py-2.5">Pending</th>
                  <th className="text-right px-5 py-2.5">Avg wait</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {concurrentPendingByPerson.map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm font-medium text-slate-800">{p.name}</td>
                    <td className="px-3 py-3 text-xs text-slate-500 hidden sm:table-cell">{ROLE_DISPLAY[p.role] || p.role}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                        {p.pending_count}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right"><DaysChip days={p.avg_days_waiting} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Stage timing */}
        <Card>
          <div className="font-semibold text-slate-800 mb-1">Typical approval timeline</div>
          <p className="text-xs text-slate-500 mb-5">Median days spent at each stage (completed transitions)</p>
          <div className="space-y-5">
            {stageTiming.map((s, i) => {
              const med = s.medianDays ?? 0;
              const sla = s.stage === 'System Owner' ? 3 : 5;
              const maxBar = Math.max(med, sla, s.avgOpenDays ?? 0, 10);
              const medPct = (med / maxBar) * 100;
              const slaPct = (sla / maxBar) * 100;
              const breached = med > sla;
              return (
                <div key={i}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-700">{s.stage}</span>
                    <span className="text-xs text-slate-500">
                      {s.completedCount} completed ·{' '}
                      <span className={`font-bold ${breached ? 'text-red-600' : 'text-emerald-600'}`}>
                        {med ?? '—'}d median
                      </span>
                      {' '}· SLA {sla}d
                    </span>
                  </div>
                  <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${medPct}%`, background: breached ? '#fca5a5' : '#86efac' }} />
                    <div className="absolute top-0 bottom-0 w-0.5 bg-red-500"
                      style={{ left: `${Math.min(slaPct, 100)}%` }} />
                  </div>
                  {s.openCount > 0 && (
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                      <Clock size={10} />
                      <span>{s.openCount} currently open — avg {s.avgOpenDays}d waiting</span>
                      {(s.maxOpenDays ?? 0) > sla && (
                        <Badge variant="warning" size="xs">longest {s.maxOpenDays}d</Badge>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {routeBacksByPerson.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Route-back frequency</div>
              <div className="space-y-1.5">
                {routeBacksByPerson.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{r.actor_name}</span>
                    <div className="flex items-center gap-1.5">
                      <RotateCcw size={11} className="text-amber-500" />
                      <span className="text-amber-700 font-semibold text-xs">{r.route_back_count}×</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* System Owner queue */}
      {systemOwnerRisks.length > 0 && (
        <Card padding={false} className="mb-5">
          <div className="px-5 pt-5 pb-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-800">Awaiting System Owner approval</div>
              <p className="text-xs text-slate-500 mt-0.5">{systemOwnerRisks.length} item{systemOwnerRisks.length !== 1 ? 's' : ''} pending</p>
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="text-left px-5 py-2.5">Risk</th>
                <th className="text-right px-5 py-2.5">Waiting</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {systemOwnerRisks.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link to={`/risk/${r.id}`} className="text-sm font-medium text-blue-700 hover:underline">{r.title}</Link>
                    <div className="font-mono text-xs text-slate-400 mt-0.5">{r.id}</div>
                  </td>
                  <td className="px-5 py-3 text-right"><DaysChip days={r.days_waiting} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* In-flight risks with concurrent approval status */}
      <Card padding={false}>
        <div className="px-5 pt-5 pb-3 border-b border-slate-200">
          <div className="font-semibold text-slate-800">All open risk acceptances</div>
          <p className="text-xs text-slate-500 mt-0.5">Who has approved and who is still pending for each item</p>
        </div>
        {inFlight.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <CheckCircle size={28} className="text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No open risk acceptances.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {inFlight.map((r, i) => {
              const level = computeLevel(r.inherent_score || r.impact * r.likelihood);
              return (
                <div key={i} className="px-5 py-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs text-slate-400">{r.id}</span>
                        <RiskBadge level={level} />
                        <Badge variant={r.stage === 'System Owner' ? 'biz-review' : 'cyber-review'} size="xs">{r.stage}</Badge>
                      </div>
                      <Link to={`/risk/${r.id}`} className="text-sm font-semibold text-slate-900 hover:text-blue-700 leading-snug block">
                        {r.title}
                      </Link>
                      {r.stage === 'Concurrent Review' && r.approvals && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {r.approvals.map((a, j) => (
                            <span key={j} className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border ${
                              a.status === 'approved'    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                              a.status === 'routed_back' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                                           'bg-slate-50 border-slate-200 text-slate-500'
                            }`}>
                              <StatusDot status={a.status} />
                              {a.actor_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <DaysChip days={r.days_in_stage} />
                      <Link to={`/risk/${r.id}`} className="text-slate-400 hover:text-blue-600">
                        <ChevronRight size={16} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      </div>
    </>
  );
}
