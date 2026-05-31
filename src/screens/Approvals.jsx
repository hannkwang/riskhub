import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock, AlertTriangle, CheckCircle, ChevronRight,
  MessageSquare, RotateCcw, Check, X, Filter,
} from 'lucide-react';
import { api } from '../lib/api';
import { useUser } from '../contexts/UserContext';
import { Badge, RiskBadge, Avatar, Button, Card, PageHeader } from '../components/ui';

const ROLE_STAGE = {
  biz_owner:      'System Owner',
  security:       'Concurrent Review',
  tech_governance:'Concurrent Review',
  grc_chair:      'Concurrent Review',
};

const CONCURRENT_ROLES = new Set(['security', 'tech_governance', 'grc_chair']);

function SlaChip({ remaining, breached }) {
  if (breached) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
      <AlertTriangle size={11} /> Overdue {Math.abs(remaining)}d
    </span>
  );
  if (remaining <= 1) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
      <Clock size={11} /> Due in {remaining}d
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
      <Clock size={11} /> {remaining}d left
    </span>
  );
}

function ApprovalCard({ item, onAction, isConcurrent, actionLoading }) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');

  function act(action) { onAction(item.id, action, note); }

  return (
    <Card padding={false} className={`overflow-hidden transition-shadow hover:shadow-md ${item.slaBreached ? 'border-red-200' : ''}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="font-mono text-xs text-slate-400">{item.id}</span>
              <RiskBadge level={item.level} />
              <SlaChip remaining={item.slaRemaining} breached={item.slaBreached} />
            </div>
            <Link to={`/risk/${item.id}`} className="text-base font-semibold text-slate-900 hover:text-blue-700 transition-colors leading-snug block mb-1">
              {item.title}
            </Link>
            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
              <span>{item.system}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Avatar initials={item.owner ? item.owner.split(' ').map(p=>p[0]).join('') : '?'} size="xs" />
                {item.owner}
              </span>
              <span>·</span>
              <span>awaiting {item.awaitingSince}</span>
            </div>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-slate-400 hover:text-slate-600 p-1 rounded flex-shrink-0">
            <ChevronRight size={18} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        </div>

        {item.lastComment && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
            <MessageSquare size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-slate-600 flex-1">
              <span className="font-medium">{item.commentAuthor}:</span> {item.lastComment}
            </div>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-slate-100 p-5 bg-slate-50">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isConcurrent ? 'Add a comment (required when routing back)…' : 'Add a note (optional)…'}
            rows={2}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
          />
          {isConcurrent ? (
            <div className="flex items-center justify-between">
              <Button variant="secondary" size="sm" onClick={() => act('route_back')} disabled={actionLoading || !note.trim()}>
                <RotateCcw size={13} /> Route back
              </Button>
              <Button size="sm" onClick={() => act('approve')} disabled={actionLoading}>
                <Check size={13} /> Approve
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <Button variant="danger-ghost" size="sm" onClick={() => act('reject')} disabled={actionLoading}>
                <X size={13} /> Reject
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => act('request_changes')} disabled={actionLoading}>
                  <RotateCcw size={13} /> Request changes
                </Button>
                <Button size="sm" onClick={() => act('approve')} disabled={actionLoading}>
                  <Check size={13} /> Approve &amp; route on
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {!expanded && (
        <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between bg-white">
          <Link to={`/risk/${item.id}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            View full assessment <ChevronRight size={12} />
          </Link>
          {isConcurrent ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="xs" onClick={() => setExpanded(true)} disabled={actionLoading}>
                <RotateCcw size={12} /> Route back
              </Button>
              <Button size="xs" onClick={() => act('approve')} disabled={actionLoading}>
                <Check size={12} /> Approve
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" size="xs" onClick={() => act('request_changes')} disabled={actionLoading}>
                <RotateCcw size={12} /> Request changes
              </Button>
              <Button size="xs" onClick={() => act('approve')} disabled={actionLoading}>
                <Check size={12} /> Approve
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function Approvals() {
  const { currentUser } = useUser();
  const [items, setItems]           = useState([]);
  const [done, setDone]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('all');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]           = useState(null);

  const role  = currentUser?.role;
  const stage = ROLE_STAGE[role];
  const isConcurrent = CONCURRENT_ROLES.has(role);

  const loadQueue = useCallback(() => {
    if (!stage) { setLoading(false); return; }
    setLoading(true);
    api.getQueue(role)
      .then(data => { setError(null); setItems(data); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [role, stage]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  async function handleAction(riskId, action, comment) {
    if (!currentUser) return;
    setActionLoading(true);
    try {
      if (isConcurrent) {
        await api.concurrentAction(riskId, { action, comment });
      } else {
        await api.transition(riskId, { action, comment });
      }
      const item = items.find(i => i.id === riskId);
      // For concurrent approve, item stays in queue for other reviewers — but remove from this user's view
      setItems(prev => prev.filter(i => i.id !== riskId));
      if (item) {
        const label = action === 'approve' ? 'Approved' : action === 'route_back' ? 'Routed back' : action === 'reject' ? 'Rejected' : 'Changes requested';
        setDone(prev => [{ ...item, resolvedAt: 'Just now', resolution: label }, ...prev]);
      }
    } catch (e) {
      alert(`Action failed: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  }

  const breached = items.filter(i => i.slaBreached);
  const urgent   = items.filter(i => !i.slaBreached && i.slaRemaining <= 2);
  const visible  = filter === 'breached' ? breached : filter === 'urgent' ? urgent : items;

  if (!role || !stage) {
    return (
      <>
        <PageHeader title="My Approvals" subtitle="Items awaiting your action" />
        <Card className="py-12 text-center">
          <div className="text-sm text-slate-500">
            {currentUser ? `The "${currentUser.role}" role has no approval queue.` : 'Select a user from the sidebar to see your queue.'}
          </div>
        </Card>
      </>
    );
  }

  const stageLabel = isConcurrent ? 'Concurrent Review' : stage;

  return (
    <>
      <PageHeader
        title="My Approvals"
        subtitle={loading ? 'Loading…' : `${items.length} item${items.length !== 1 ? 's' : ''} awaiting your action in ${stageLabel}`}
        actions={
          <div className="flex items-center gap-2 text-sm">
            <Filter size={14} className="text-slate-400" />
            {[
              { key: 'all',      label: `All (${items.length})` },
              { key: 'breached', label: `Overdue (${breached.length})` },
              { key: 'urgent',   label: `Urgent (${urgent.length})` },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === key ? 'bg-blue-700 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}>
                {label}
              </button>
            ))}
          </div>
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {isConcurrent && (
        <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
          <strong>Concurrent review:</strong> Each item requires independent approval from Cyber Security, Tech Governance, and both GRC Co-Chairs. You can approve or route back independently of other reviewers.
        </div>
      )}

      {breached.length > 0 && filter === 'all' && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl mb-5 text-sm text-red-700">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span><strong>{breached.length} item{breached.length > 1 ? 's' : ''}</strong> past SLA — action needed immediately.</span>
          <button onClick={() => setFilter('breached')} className="ml-auto text-xs font-semibold underline">Show only overdue</button>
        </div>
      )}

      <div className="space-y-3 mb-8">
        {loading && <Card className="py-8 text-center text-sm text-slate-400">Loading queue…</Card>}
        {!loading && visible.length === 0 && (
          <Card className="py-12 text-center">
            <CheckCircle size={36} className="text-emerald-400 mx-auto mb-3" />
            <div className="text-base font-semibold text-slate-600">You're all caught up</div>
            <div className="text-sm text-slate-400 mt-1">No pending approvals match this filter.</div>
          </Card>
        )}
        {visible.map((item) => (
          <ApprovalCard key={item.id} item={item} onAction={handleAction} isConcurrent={isConcurrent} actionLoading={actionLoading} />
        ))}
      </div>

      {done.length > 0 && (
        <>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Resolved this session</div>
          <Card padding={false}>
            {done.map((item, i) => (
              <div key={`${item.id}-${i}`} className={`flex items-center gap-4 px-5 py-3.5 ${i < done.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${item.resolution === 'Approved' ? 'bg-emerald-100' : item.resolution === 'Routed back' ? 'bg-amber-100' : 'bg-red-100'}`}>
                  {item.resolution === 'Approved'
                    ? <Check size={13} className="text-emerald-600" />
                    : item.resolution === 'Routed back'
                    ? <RotateCcw size={13} className="text-amber-600" />
                    : <X size={13} className="text-red-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-700">{item.title}</span>
                  <span className="text-xs text-slate-400 ml-2 font-mono">{item.id}</span>
                </div>
                <Badge variant={item.resolution === 'Approved' ? 'success' : item.resolution === 'Routed back' ? 'warning' : 'danger'} size="xs">
                  {item.resolution}
                </Badge>
                <span className="text-xs text-slate-400 flex-shrink-0">{item.resolvedAt}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
