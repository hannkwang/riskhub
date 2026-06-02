import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronRight, X, Save, ExternalLink, CalendarClock, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import { useUser } from '../contexts/UserContext';
import { timeAgo, formatDate } from '../lib/time';
import { Badge, RiskBadge, StageBadge, Avatar, Button, Card, PageHeader, Select } from '../components/ui';

const STAGES = ['Draft', 'System Owner', 'Concurrent Review', 'Approved', 'Rejected'];
const LEVELS = ['High', 'Medium', 'Low', 'Very Low'];
const STAGE_ORDER = Object.fromEntries(STAGES.map((s, i) => [s, i]));

function SortHeader({ label, col, sortCol, sortAsc, onSort, align = 'left', className = '' }) {
  const active = sortCol === col;
  const Icon = active ? (sortAsc ? ChevronUp : ChevronDown) : ArrowUpDown;
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-4 py-3 cursor-pointer select-none hover:bg-slate-100 transition-colors ${className}`}
    >
      <span className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider ${active ? 'text-blue-700' : 'text-slate-500'} ${align === 'center' ? 'justify-center w-full' : ''}`}>
        {label}
        <Icon size={11} className={active ? 'text-blue-500' : 'text-slate-300'} />
      </span>
    </th>
  );
}

function EditPanel({ risk, onClose, onSaved, systems }) {
  const [title, setTitle]           = useState(risk.title || '');
  const [statement, setStatement]   = useState(risk.risk_statement || '');
  const [system, setSystem]         = useState(risk.system || '');
  const [owner, setOwner]           = useState(risk.owner || '');
  const [team, setTeam]             = useState(risk.team || '');
  const [justification, setJust]    = useState(risk.justification || '');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateRisk(risk.id, {
        title: title.trim(),
        risk_statement: statement.trim(),
        system_name: system,
        owner: owner.trim(),
        team: team.trim(),
        justification: justification.trim(),
      });
      onSaved(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <span className="font-mono text-xs text-slate-500">{risk.id}</span>
            <div className="text-sm font-semibold text-slate-800 mt-0.5 truncate max-w-xs">{risk.title}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Risk Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Risk Description</label>
            <textarea value={statement} onChange={e => setStatement(e.target.value)} rows={4}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">System</label>
            <select value={system} onChange={e => setSystem(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {systems.map(s => <option key={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Owner</label>
              <input value={owner} onChange={e => setOwner(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Team</label>
              <input value={team} onChange={e => setTeam(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Justification</label>
            <textarea value={justification} onChange={e => setJust(e.target.value)} rows={3}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div className="pt-2 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Read-only</div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <span>Stage: <strong>{risk.stage}</strong></span>
              <span>Level: <strong>{risk.level}</strong></span>
              <span>Score: <strong>{risk.score}</strong></span>
              <span>Created: <strong>{formatDate(risk.created_at)}</strong></span>
              {risk.expiresAt && <span className="col-span-2">Expires: <strong>{formatDate(risk.expiresAt)}</strong></span>}
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between gap-3">
          <Link to={`/risk/${risk.id}`} onClick={onClose}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
            <ExternalLink size={13} /> Open full view
          </Link>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              <Save size={13} /> {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RiskAcceptanceDB() {
  const { currentUser } = useUser();
  const canEdit = currentUser?.role === 'tech_governance' || currentUser?.role === 'grc_chair';

  const [risks, setRisks]       = useState([]);
  const [systems, setSystems]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]           = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [dateMode, setDateMode]       = useState('all');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [expiredOnly, setExpiredOnly] = useState(false);
  const [sortCol, setSortCol]         = useState('updated_at');
  const [sortAsc, setSortAsc]         = useState(false);
  const [editing, setEditing]         = useState(null);

  function toggleSort(col) {
    if (sortCol === col) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(true); }
  }

  const today = new Date().toISOString().split('T')[0];

  function sixMonthsAgo() {
    const d = new Date(); d.setMonth(d.getMonth() - 6);
    return d.toISOString().split('T')[0];
  }

  useEffect(() => {
    Promise.all([api.getRisks(), api.getSystems()])
      .then(([r, s]) => { setRisks(r); setSystems(s); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const q = search.toLowerCase();
  const fromCutoff = dateMode === '6m' ? sixMonthsAgo() : (dateMode === 'custom' ? dateFrom : '');
  const toCutoff   = dateMode === 'custom' ? dateTo : '';

  const filtered = risks.filter(r => {
    if (filterStage && r.stage !== filterStage) return false;
    if (filterLevel && r.level !== filterLevel) return false;
    if (q && !r.id.toLowerCase().includes(q) && !r.title?.toLowerCase().includes(q) &&
        !r.owner?.toLowerCase().includes(q) && !r.system?.toLowerCase().includes(q)) return false;
    const created = r.created_at ? r.created_at.split(' ')[0] : '';
    if (fromCutoff && created < fromCutoff) return false;
    if (toCutoff   && created > toCutoff)   return false;
    if (expiredOnly && !(r.expiresAt && r.expiresAt < today)) return false;
    return true;
  }).sort((a, b) => {
    let av, bv;
    switch (sortCol) {
      case 'id':            av = a.id;             bv = b.id;             break;
      case 'title':         av = (a.title || '').toLowerCase(); bv = (b.title || '').toLowerCase(); break;
      case 'owner':         av = (a.owner || '').toLowerCase(); bv = (b.owner || '').toLowerCase(); break;
      case 'score':         av = a.score ?? -1;    bv = b.score ?? -1;    break;
      case 'residual_score':av = a.residual_score ?? -1; bv = b.residual_score ?? -1; break;
      case 'stage':         av = STAGE_ORDER[a.stage] ?? 99; bv = STAGE_ORDER[b.stage] ?? 99; break;
      case 'updated_at':    av = a.updated_at || ''; bv = b.updated_at || ''; break;
      case 'expiresAt':     av = a.expiresAt || ''; bv = b.expiresAt || ''; break;
      default:              return 0;
    }
    if (av < bv) return sortAsc ? -1 : 1;
    if (av > bv) return sortAsc ? 1 : -1;
    return 0;
  });

  function handleSaved(updated) {
    setRisks(prev => prev.map(r => r.id === updated.id ? updated : r));
    setEditing(null);
  }

  return (
    <>
      <PageHeader
        title="Risk Acceptance DB"
        subtitle={loading ? 'Loading…' : `${filtered.length} of ${risks.length} risk assessments`}
      />

      <Card padding={false}>
        <div className="p-4 border-b border-slate-200 space-y-3">
          {/* Row 1: search + stage + level */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by ID, title, owner, system…"
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <Select value={filterStage} onChange={e => setFilterStage(e.target.value)}>
              <option value="">All stages</option>
              {STAGES.map(s => <option key={s}>{s}</option>)}
            </Select>
            <Select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
              <option value="">All levels</option>
              {LEVELS.map(l => <option key={l}>{l}</option>)}
            </Select>
            <button
              onClick={() => setExpiredOnly(o => !o)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                expiredOnly
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CalendarClock size={12} />
              Expired only
            </button>
          </div>

          {/* Row 2: date filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <CalendarClock size={14} className="text-slate-400 flex-shrink-0" />
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              {[['all','All time'],['6m','Last 6 months'],['custom','Custom range']].map(([key, label]) => (
                <button key={key} onClick={() => setDateMode(key)}
                  className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors ${dateMode === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {label}
                </button>
              ))}
            </div>
            {dateMode === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-xs text-slate-400">to</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
            {(search || filterStage || filterLevel || expiredOnly || dateMode !== 'all') && (
              <button onClick={() => { setSearch(''); setFilterStage(''); setFilterLevel(''); setExpiredOnly(false); setDateMode('all'); setDateFrom(''); setDateTo(''); }}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 ml-auto">
                <X size={12} /> Clear all
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <SortHeader label="ID"       col="id"            sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort} className="w-32" />
                  <SortHeader label="Title"    col="title"         sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort} />
                  <SortHeader label="Owner"    col="owner"         sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort} className="w-36 hidden md:table-cell" />
                  <SortHeader label="Inherent Risk" col="score"          sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort} align="center" className="w-28" />
                  <SortHeader label="Residual Risk" col="residual_score" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort} align="center" className="w-28 hidden md:table-cell" />
                  <SortHeader label="Stage"       col="stage"             sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort} className="w-36 hidden sm:table-cell" />
                  <SortHeader label="Updated"  col="updated_at"    sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort} className="w-28 hidden lg:table-cell" />
                  <SortHeader label="Expires"  col="expiresAt"     sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort} className="w-28 hidden xl:table-cell" />
                  <th className="w-20 px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-500">{r.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-800 line-clamp-1">{r.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{r.system}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <Avatar initials={r.owner ? r.owner.split(' ').map(p=>p[0]).join('') : '?'} size="xs" />
                        <span className="text-xs text-slate-600 truncate max-w-[110px]">{r.owner}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center"><RiskBadge level={r.level} /></td>
                    <td className="px-3 py-3 text-center hidden md:table-cell">
                      {r.residual_level
                        ? <RiskBadge level={r.residual_level} />
                        : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell"><StageBadge stage={r.stage} /></td>
                    <td className="px-4 py-3 text-xs text-slate-400 hidden lg:table-cell">{timeAgo(r.updated_at)}</td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {r.expiresAt
                        ? <span className="text-xs text-slate-500">{formatDate(r.expiresAt)}</span>
                        : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canEdit && (
                          <button onClick={() => setEditing(r)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors">
                            Edit
                          </button>
                        )}
                        <Link to={`/risk/${r.id}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 inline-flex opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight size={15} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">No risks match.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-200 text-xs text-slate-400">
          {filtered.length} of {risks.length} risks
        </div>
      </Card>

      {editing && (
        <EditPanel
          risk={editing}
          systems={systems}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
