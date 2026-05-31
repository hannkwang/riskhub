import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { parseUtc, timeAgo } from '../lib/time';
import { PageHeader, Card, Badge, RiskBadge, Button } from '../components/ui';
import { ChevronRight, Clock, Check, RotateCcw, CalendarClock } from 'lucide-react';

function sixMonthsAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().split('T')[0];
}

const STAGES = ['Draft', 'System Owner', 'Concurrent Review'];

const STAGE_META = {
  'Draft':             { color: 'bg-slate-100 border-slate-200',   label: 'bg-slate-100 text-slate-600',   desc: 'Being prepared by engineer' },
  'System Owner':      { color: 'bg-purple-50 border-purple-200',  label: 'bg-purple-100 text-purple-700', desc: 'Awaiting system owner approval' },
  'Concurrent Review': { color: 'bg-amber-50 border-amber-200',    label: 'bg-amber-100 text-amber-700',   desc: 'Under parallel review by all teams' },
};


function ApprovalMini({ approvals }) {
  if (!approvals?.length) return null;
  const approved = approvals.filter(a => a.status === 'approved').length;
  const routedBack = approvals.filter(a => a.status === 'routed_back').length;
  const total = approvals.length;
  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      {approvals.map(a => (
        <span key={a.actor_id} title={`${a.actor_name}: ${a.status}`}
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
            a.status === 'approved'    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
            a.status === 'routed_back' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                         'bg-slate-50 border-slate-200 text-slate-500'
          }`}>
          {a.status === 'approved'    ? <Check size={9} /> :
           a.status === 'routed_back' ? <RotateCcw size={9} /> :
                                        <Clock size={9} />}
          {a.actor_name}
        </span>
      ))}
      <span className="text-xs text-slate-400">{approved}/{total} approved</span>
      {routedBack > 0 && <span className="text-xs text-amber-600 font-medium">{routedBack} need info</span>}
    </div>
  );
}

export default function WorkflowOverview() {
  const [risksByStage, setRisksByStage] = useState({});
  const [concurrentStatus, setConcurrentStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [dateMode, setDateMode] = useState('6m');
  const [customDate, setCustomDate] = useState(sixMonthsAgo());

  const fromDate = dateMode === '6m' ? sixMonthsAgo() : customDate;

  const filteredByStage = useMemo(() => {
    const cutoff = fromDate ? parseUtc(fromDate + 'T00:00:00') : null;
    const result = {};
    STAGES.forEach(s => {
      result[s] = (risksByStage[s] || []).filter(r =>
        !cutoff || (parseUtc(r.created_at) >= cutoff)
      );
    });
    return result;
  }, [risksByStage, fromDate]);

  useEffect(() => {
    api.getRisks({ stage: STAGES.join(',') })
      .then(async risks => {
        const grouped = {};
        STAGES.forEach(s => { grouped[s] = []; });
        risks.forEach(r => { if (grouped[r.stage]) grouped[r.stage].push(r); });
        setRisksByStage(grouped);

        // Load concurrent status for all Concurrent Review risks
        const concurrentRisks = risks.filter(r => r.stage === 'Concurrent Review');
        const statusMap = {};
        await Promise.all(concurrentRisks.map(async r => {
          try {
            const cs = await api.getConcurrentStatus(r.id);
            statusMap[r.id] = cs;
          } catch {}
        }));
        setConcurrentStatus(statusMap);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalOpen = Object.values(filteredByStage).reduce((s, arr) => s + arr.length, 0);

  return (
    <>
      <PageHeader
        title="Workflow Overview"
        subtitle={loading ? 'Loading…' : `${totalOpen} risk acceptance${totalOpen !== 1 ? 's' : ''} in progress`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
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
            <Link to="/new">
              <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors">
                + New Risk
              </button>
            </Link>
          </div>
        }
      />

      {loading ? (
        <Card className="py-12 text-center text-sm text-slate-400">Loading…</Card>
      ) : totalOpen === 0 ? (
        <Card className="py-12 text-center">
          <div className="text-slate-400 text-sm">No risk acceptances currently in progress.</div>
          <Link to="/new" className="mt-3 inline-block text-blue-600 text-sm hover:underline">Start a new one →</Link>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-5">
          {STAGES.map(stage => {
            const risks = filteredByStage[stage] || [];
            const meta = STAGE_META[stage];
            return (
              <div key={stage}>
                {/* Column header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${meta.label}`}>
                      {stage}
                    </span>
                    <span className="text-xs text-slate-400">{risks.length}</span>
                  </div>
                  <span className="text-xs text-slate-400">{meta.desc}</span>
                </div>

                {/* Cards */}
                <div className="space-y-3">
                  {risks.length === 0 && (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl py-8 text-center text-xs text-slate-400">
                      Nothing here
                    </div>
                  )}
                  {risks.map(r => {
                    const approvals = concurrentStatus[r.id];
                    return (
                      <Link key={r.id} to={`/risk/${r.id}`}
                        className={`block rounded-xl border p-4 hover:shadow-md transition-shadow ${meta.color}`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="font-mono text-xs text-slate-400">{r.id}</span>
                          <RiskBadge level={r.level} />
                        </div>
                        <p className="text-sm font-semibold text-slate-800 leading-snug mb-2 line-clamp-2">
                          {r.title}
                        </p>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{r.owner}</span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {timeAgo(r.updated_at)}
                          </span>
                        </div>
                        {stage === 'Concurrent Review' && approvals && (
                          <ApprovalMini approvals={approvals} />
                        )}
                        <div className="flex items-center justify-end mt-2 text-xs text-blue-600">
                          View details <ChevronRight size={12} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
