import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Check, Clock, MessageSquare, History,
  AlertTriangle, Sparkles, X, RotateCcw, Users, Trash2,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate } from '../lib/time';
import { useUser } from '../contexts/UserContext';
import { Badge, RiskBadge, Avatar, Button, Card, Divider } from '../components/ui';

const ORDERED_STAGES = ['Draft', 'System Owner', 'Concurrent Review', 'Approved'];

const STAGE_APPROVER_ROLE = {
  'System Owner': 'biz_owner',
};

const NEXT_STAGE_LABEL = {
  'System Owner': 'Concurrent Review',
};

const CONCURRENT_ROLES = new Set(['security', 'tech_governance', 'grc_chair']);

const ROLE_DISPLAY = {
  security:       'Cyber Security',
  tech_governance:'Tech Governance Assurance',
  grc_chair:      'GRC Co-Chair',
};

// Roles where any one member approving satisfies the team requirement
const TEAM_BASED_ROLES = new Set(['security', 'tech_governance']);

function computeLevel(score) {
  if (score >= 15) return 'High';
  if (score >= 9)  return 'Medium';
  if (score >= 4)  return 'Low';
  return 'Very Low';
}

function StatusPip({ status }) {
  if (status === 'approved')    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"><Check size={10} /> Approved</span>;
  if (status === 'routed_back') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"><RotateCcw size={10} /> Needs info</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full"><Clock size={10} /> Pending</span>;
}

export default function Workflow() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useUser();

  const [risk, setRisk]                 = useState(null);
  const [history, setHistory]           = useState([]);
  const [concurrentStatus, setConcurrent] = useState([]);
  const [tab, setTab]                   = useState('comments');
  const [comment, setComment]           = useState('');
  const [loading, setLoading]           = useState(true);
  const [acting, setActing]             = useState(false);
  const [deleting, setDeleting]         = useState(false);

  useEffect(() => { if (!id) navigate('/'); }, [id, navigate]);

  async function reload() {
    const [r, h] = await Promise.all([api.getRisk(id), api.getHistory(id)]);
    setRisk(r);
    setHistory(h);
    if (r.stage === 'Concurrent Review') {
      const cs = await api.getConcurrentStatus(id);
      setConcurrent(cs);
    } else {
      setConcurrent([]);
    }
  }

  useEffect(() => {
    if (!id) return;
    reload().catch(console.error).finally(() => setLoading(false));
  }, [id]);

  async function act(action) {
    if (!currentUser || !risk) return;
    setActing(true);
    try {
      await api.transition(risk.id, { action, comment });
      await reload();
      setComment('');
    } catch (e) { alert(`Failed: ${e.message}`); }
    finally { setActing(false); }
  }

  async function concurrentAct(action) {
    if (!currentUser || !risk) return;
    setActing(true);
    try {
      await api.concurrentAction(risk.id, { action, comment });
      await reload();
      setComment('');
    } catch (e) { alert(`Failed: ${e.message}`); }
    finally { setActing(false); }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${risk.id} permanently? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.deleteRisk(risk.id);
      navigate('/');
    } catch (e) { alert(`Delete failed: ${e.message}`); }
    finally { setDeleting(false); }
  }

  async function raiserRespond() {
    if (!currentUser || !risk || !comment.trim()) return;
    setActing(true);
    try {
      await api.raiserRespond(risk.id, { comment });
      await reload();
      setComment('');
    } catch (e) { alert(`Failed: ${e.message}`); }
    finally { setActing(false); }
  }

  if (loading) return <div className="px-6 py-12 text-center text-sm text-slate-400">Loading…</div>;

  if (!risk) {
    return (
      <div className="px-6 py-12 text-center">
        <div className="text-sm text-slate-400 mb-4">Risk not found.</div>
        <Link to="/" className="text-sm text-blue-600 hover:underline">← Back to dashboard</Link>
      </div>
    );
  }

  const currentStageIdx = ORDERED_STAGES.indexOf(risk.stage);
  const isTerminal = risk.stage === 'Approved' || risk.stage === 'Rejected';

  // Derive participants from history
  const submitEntry       = history.find(h => h.action === 'submit');
  const systemOwnerEntry  = history.find(h => h.from_stage === 'System Owner' && ['approve','reject','request_changes'].includes(h.action));

  // Standard approver (System Owner stage)
  const canAct = currentUser && STAGE_APPROVER_ROLE[risk.stage] === currentUser.role;
  const nextLabel = NEXT_STAGE_LABEL[risk.stage];

  // Concurrent review
  const isConcurrentStage = risk.stage === 'Concurrent Review';
  const isConcurrentReviewer = isConcurrentStage && currentUser && CONCURRENT_ROLES.has(currentUser.role);
  const myApprovalRow = isConcurrentReviewer
    ? concurrentStatus.find(r => r.actor_id === currentUser.id)
    : null;
  const isRaiser = isConcurrentStage && currentUser && (currentUser.id === risk.created_by || currentUser.role === 'engineer');
  const canSubmit = risk.stage === 'Draft' && currentUser && (currentUser.id === risk.created_by || currentUser.role === 'engineer');
  const routedBackRows = concurrentStatus.filter(r => r.status === 'routed_back');

  const comments = history.filter(h => h.comment && h.action !== 'create' && h.action !== 'ai_review');

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ChevronLeft size={16} /> Dashboard
        </Link>
        <span className="text-slate-300">/</span>
        <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{risk.id}</span>
        <Badge variant={risk.stage === 'Approved' ? 'approved' : risk.stage === 'Rejected' ? 'danger' : 'cyber-review'}>
          {risk.stage}
        </Badge>
        {currentUser && (currentUser.role === 'tech_governance' || currentUser.role === 'grc_chair') && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="ml-auto flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors border border-transparent hover:border-red-200 disabled:opacity-50"
          >
            <Trash2 size={13} /> {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>

      <h1 className="text-xl font-bold text-slate-900 mb-4">{risk.title}</h1>

      {/* Participants strip */}
      <div className="flex flex-wrap gap-x-6 gap-y-3 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm">
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Raised by</div>
          <span className="font-semibold text-slate-800">{risk.owner}</span>
          {risk.team && <span className="text-slate-400 ml-1">· {risk.team}</span>}
          {submitEntry && <span className="text-slate-400 ml-1">· {submitEntry.time_ago}</span>}
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">System</div>
          <span className="font-medium text-slate-700">{risk.system}</span>
          <span className="font-mono text-xs text-slate-400 ml-2">{risk.id}</span>
        </div>
        {systemOwnerEntry && (
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">System Owner</div>
            <span className="font-semibold text-slate-800">{systemOwnerEntry.actor_name}</span>
            <span className={`ml-2 inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
              systemOwnerEntry.action === 'approve' ? 'bg-emerald-100 text-emerald-700' :
              systemOwnerEntry.action === 'reject'  ? 'bg-red-100 text-red-700' :
                                                      'bg-amber-100 text-amber-700'
            }`}>
              {systemOwnerEntry.action === 'approve' ? 'Approved' : systemOwnerEntry.action === 'reject' ? 'Rejected' : 'Changes requested'}
            </span>
            <span className="text-slate-400 ml-1">· {systemOwnerEntry.time_ago}</span>
          </div>
        )}
        {isTerminal && (() => {
          const approvedRows = concurrentStatus.filter(r => r.status === 'approved');
          return approvedRows.length > 0 ? (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Approved by</div>
              <span className="text-slate-700">{approvedRows.map(r => r.actor_name).join(', ')}</span>
            </div>
          ) : null;
        })()}
      </div>

      {/* Stage track */}
      <Card className="mb-6">
        <div className="flex items-center gap-0">
          {ORDERED_STAGES.map((stageName, i) => {
            const isDone   = currentStageIdx > i || (risk.stage === 'Approved' && stageName === 'Approved');
            const isActive = risk.stage === stageName;
            return (
              <div key={stageName} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all ${
                    isDone   ? 'bg-emerald-500 border-emerald-500 text-white' :
                    isActive ? 'bg-white border-blue-700 text-blue-700 shadow-md shadow-blue-100 ring-4 ring-blue-50' :
                               'bg-white border-slate-300 text-slate-400'
                  }`}>
                    {isDone ? <Check size={16} /> : i + 1}
                  </div>
                  <div className="text-center">
                    <div className={`text-xs font-semibold ${isActive ? 'text-blue-700' : isDone ? 'text-slate-700' : 'text-slate-400'}`}>
                      {stageName}
                    </div>
                    {stageName === 'Concurrent Review' && isActive && (() => {
                      const secOk  = concurrentStatus.some(r => r.role === 'security'        && r.status === 'approved');
                      const tgaOk  = concurrentStatus.some(r => r.role === 'tech_governance' && r.status === 'approved');
                      const grcRows = concurrentStatus.filter(r => r.role === 'grc_chair');
                      const grcOk  = grcRows.length > 0 && grcRows.every(r => r.status === 'approved');
                      const teamsApproved = [secOk, tgaOk, grcOk].filter(Boolean).length;
                      return (
                        <div className="text-xs text-slate-400">{teamsApproved}/3 approved</div>
                      );
                    })()}
                  </div>
                </div>
                {i < ORDERED_STAGES.length - 1 && (
                  <div className={`h-0.5 w-full mt-[-28px] ${isDone ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Concurrent review panel */}
      {isConcurrentStage && concurrentStatus.length > 0 && (() => {
        const groups = [
          { role: 'security',       label: 'Cyber Security',            anyOne: true  },
          { role: 'tech_governance',label: 'Tech Governance Assurance', anyOne: true  },
          { role: 'grc_chair',      label: 'GRC Co-Chair',             anyOne: false },
        ];
        return (
          <Card className="mb-5">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">Concurrent Review Panel</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {groups.map(({ role, label, anyOne }) => {
                const members = concurrentStatus.filter(r => r.role === role);
                const teamApproved = anyOne && members.some(r => r.status === 'approved');
                return (
                  <div key={role} className={`rounded-xl border p-3 ${teamApproved ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700">{label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${anyOne ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {anyOne ? 'Any one' : 'All required'}
                      </span>
                    </div>
                    {teamApproved && (
                      <div className="flex items-center gap-1 mb-2">
                        <Check size={12} className="text-emerald-600" />
                        <span className="text-xs font-semibold text-emerald-700">Team approved</span>
                      </div>
                    )}
                    <div className="space-y-2">
                      {members.map(row => (
                        <div key={row.actor_id} className="flex items-start gap-2">
                          <Avatar initials={row.actor_name.split(' ').map(p => p[0]).join('')} size="xs" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-medium text-slate-800">{row.actor_name}</span>
                              <StatusPip status={row.status} />
                            </div>
                            {row.comment && (
                              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed italic">"{row.comment}"</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* Two-col: summary + activity */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Risk summary */}
        <Card>
          <h2 className="text-base font-semibold text-slate-800 mb-4">Risk Summary</h2>
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Description</div>
          <p className="text-sm text-slate-700 leading-relaxed mb-5">{risk.risk_statement || risk.title}</p>

          {/* Inherent + residual scores */}
          <div className={`grid gap-3 mb-4 ${risk.ai_residual_score ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Inherent risk</div>
              <RiskBadge level={risk.level} />
              <div className="text-xs text-slate-400 mt-1 font-mono">{risk.inherent_score} · I:{risk.impact} · L:{risk.likelihood}</div>
            </div>
            {risk.residual_score && (
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Submitter residual</div>
                <RiskBadge level={computeLevel(risk.residual_score)} />
                <div className="text-xs text-slate-400 mt-1 font-mono">{risk.residual_score} · I:{risk.residual_impact} · L:{risk.residual_likelihood}</div>
              </div>
            )}
            {risk.ai_residual_score && (() => {
              const gap = risk.ai_residual_score - (risk.residual_score || 0);
              const verdict = Math.abs(gap) <= 2 ? 'justified' : gap > 0 ? 'underestimated' : 'overestimated';
              return (
                <div className={`rounded-lg p-3 border ${
                  verdict === 'justified'      ? 'bg-emerald-50 border-emerald-200' :
                  verdict === 'underestimated' ? 'bg-red-50 border-red-200' :
                                                 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-center gap-1 mb-1">
                    <Sparkles size={11} className="text-violet-600" />
                    <span className="text-xs text-slate-500">AI residual</span>
                  </div>
                  <RiskBadge level={risk.ai_residual_level} />
                  <div className="text-xs text-slate-400 mt-1 font-mono">{risk.ai_residual_score} · I:{risk.ai_residual_impact} · L:{risk.ai_residual_likelihood}</div>
                  <span className={`mt-1.5 inline-block text-xs font-medium ${
                    verdict === 'justified'      ? 'text-emerald-700' :
                    verdict === 'underestimated' ? 'text-red-700' :
                                                   'text-amber-700'
                  }`}>
                    {verdict === 'justified' ? '✓ Justified' : verdict === 'underestimated' ? '↑ Gap — too low' : '↓ Conservative'}
                  </span>
                </div>
              );
            })()}
          </div>

          {risk.mitigations && risk.mitigations.length > 0 && (
            <>
              <Divider className="mb-4" />
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Mitigations · {risk.mitigations.length} item{risk.mitigations.length !== 1 ? 's' : ''}
              </div>
              <ul className="space-y-2">
                {risk.mitigations.map((m, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <Check size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700 flex-1">{m.text}</span>
                    {m.type && <span className="text-xs text-slate-400 flex-shrink-0 capitalize">{m.type}</span>}
                    <span className="text-xs text-slate-400 flex-shrink-0">{m.owner} · {m.due}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {risk.justification && (
            <>
              <Divider className="mb-4 mt-4" />
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Justification</div>
              <p className="text-sm text-slate-700 leading-relaxed">{risk.justification}</p>
            </>
          )}

          {risk.expiresAt && (
            <>
              <Divider className="mb-4 mt-4" />
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Approval Expires</div>
              <p className="text-sm text-slate-700">{formatDate(risk.expiresAt)}</p>
            </>
          )}
        </Card>

        {/* Activity */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800">Activity</h2>
            <div className="flex gap-1">
              {['comments', 'history'].map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                  {t === 'comments' ? <MessageSquare size={12} /> : <History size={12} />}
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 mb-4 max-h-64 overflow-y-auto">
            {tab === 'comments' ? (
              comments.length === 0
                ? <p className="text-xs text-slate-400">No comments yet.</p>
                : comments.map((c, i) => (
                  <div key={i} className="flex gap-3">
                    <Avatar initials={c.actor_name ? c.actor_name.split(' ').map(p=>p[0]).join('') : '?'} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{c.actor_name}</span>
                        <span className="text-xs text-slate-400">{c.time_ago}</span>
                        {c.action === 'request_changes' && <Badge variant="warning" size="xs">changes requested</Badge>}
                        {c.action === 'reject'          && <Badge variant="danger"  size="xs">rejected</Badge>}
                        {c.action === 'approve'         && <Badge variant="success" size="xs">approved</Badge>}
                        {c.action === 'route_back'      && <Badge variant="warning" size="xs">needs info</Badge>}
                        {c.action === 'raiser_respond'  && <Badge variant="info"    size="xs">response</Badge>}
                        {c.action === 'auto_approve'    && <Badge variant="success" size="xs">all approved</Badge>}
                      </div>
                      <p className="text-sm text-slate-600 mt-1 leading-relaxed">{c.comment}</p>
                    </div>
                  </div>
                ))
            ) : (
              history.filter(h => h.action !== 'ai_review').map((h, i) => (
                <div key={i} className="flex items-start gap-3 text-xs">
                  <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {h.action === 'approve' || h.action === 'auto_approve' ? <Check size={10} className="text-emerald-600" /> :
                     h.action === 'reject'  ? <X size={10} className="text-red-600" /> :
                                              <Clock size={10} className="text-slate-400" />}
                  </div>
                  <div>
                    <span className="font-medium text-slate-700">{h.actor_name}</span>
                    {h.from_stage !== h.to_stage
                      ? <><span className="text-slate-400"> moved to </span><span className="font-medium text-slate-700">{h.to_stage}</span></>
                      : <><span className="text-slate-400"> · </span><span className="font-medium text-slate-600">{h.action.replace('_', ' ')}</span></>
                    }
                    <span className="text-slate-400 ml-2">{h.time_ago}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <Divider className="mb-4" />

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              isConcurrentReviewer ? 'Add a comment (required when routing back)…' :
              isRaiser             ? 'Respond to reviewer questions…' :
                                     'Add a comment…'
            }
            rows={3}
            className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />

          {/* System Owner actions */}
          {canAct && (
            <div className="flex items-center justify-between mt-3">
              <Button variant="danger-ghost" size="sm" onClick={() => act('reject')} disabled={acting}>
                <X size={13} /> Reject
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => act('request_changes')} disabled={acting}>
                  <RotateCcw size={13} /> Request changes
                </Button>
                <Button size="sm" onClick={() => act('approve')} disabled={acting}>
                  <Check size={13} /> Approve {nextLabel ? `→ ${nextLabel}` : ''}
                </Button>
              </div>
            </div>
          )}

          {/* Concurrent reviewer actions */}
          {isConcurrentReviewer && myApprovalRow && (
            <div className="mt-3">
              {myApprovalRow.status === 'approved' ? (
                <p className="text-xs text-emerald-600 text-center font-medium">You have approved this risk.</p>
              ) : myApprovalRow.status === 'routed_back' ? (
                <p className="text-xs text-amber-600 text-center font-medium">You routed this back — awaiting response from the raiser.</p>
              ) : (
                <div className="flex items-center justify-between">
                  <Button variant="secondary" size="sm" onClick={() => concurrentAct('route_back')} disabled={acting || !comment.trim()}>
                    <RotateCcw size={13} /> Route back
                  </Button>
                  <Button size="sm" onClick={() => concurrentAct('approve')} disabled={acting}>
                    <Check size={13} /> Approve
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Raiser respond actions */}
          {isRaiser && routedBackRows.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={13} className="text-amber-600" />
                <span className="text-xs text-amber-700 font-medium">
                  {routedBackRows.length} reviewer{routedBackRows.length > 1 ? 's' : ''} need{routedBackRows.length === 1 ? 's' : ''} more information
                </span>
              </div>
              <Button variant="secondary" size="sm" className="w-full" onClick={raiserRespond} disabled={acting || !comment.trim()}>
                <MessageSquare size={13} /> Send response to reviewers
              </Button>
            </div>
          )}

          {canSubmit && (
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={() => act('submit')} disabled={acting}>
                <Check size={13} /> Submit to System Owner
              </Button>
            </div>
          )}

          {!canAct && !isConcurrentReviewer && !(isRaiser && routedBackRows.length > 0) && !canSubmit && (
            <p className="mt-3 text-xs text-slate-400 text-center">
              {isTerminal
                ? `This risk is ${risk.stage.toLowerCase()}.`
                : `Approval action available to the ${risk.stage} reviewer.`}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
