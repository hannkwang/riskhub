import { useState, useEffect } from 'react';
import { Search, Globe, Lock, AlertTriangle, ChevronUp, ChevronDown, X, Save, Pencil } from 'lucide-react';
import { api } from '../lib/api';
import { Badge, Card, PageHeader } from '../components/ui';
import { useUser } from '../contexts/UserContext';

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

const SELECT_CLS = 'w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';
const INPUT_CLS  = 'w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

function EditPanel({ system, onClose, onSaved }) {
  const [form, setForm] = useState({
    criticality:    system.crit        || '',
    sensitivity:    system.sens        || '',
    rml:            system.rml         || '',
    internet_facing: system.inet,
    owner:          system.owner       || '',
    team:           system.team        || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateSystem(system.id, {
        ...form,
        internet_facing: form.internet_facing ? 1 : 0,
      });
      onSaved(updated);
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm bg-white shadow-2xl border-l border-slate-200 flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <div className="text-sm font-semibold text-slate-900">{system.name}</div>
            <div className="text-xs text-slate-400 mt-0.5">Edit system metadata</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 mt-0.5"><X size={18} /></button>
        </div>

        {/* Fields */}
        <div className="flex-1 px-5 py-4 space-y-4">

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Criticality</label>
            <select className={SELECT_CLS} value={form.criticality} onChange={e => set('criticality', e.target.value)}>
              {['Critical', 'High', 'Medium', 'Low'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Sensitivity</label>
            <select className={SELECT_CLS} value={form.sensitivity} onChange={e => set('sensitivity', e.target.value)}>
              {['Restricted', 'Confidential', 'Internal', 'Public'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Risk Management Level (RML)</label>
            <select className={SELECT_CLS} value={form.rml} onChange={e => set('rml', e.target.value)}>
              {['High', 'Medium', 'Low'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Internet-facing</label>
            <div className="flex gap-3">
              {[true, false].map(v => (
                <button
                  key={String(v)}
                  onClick={() => set('internet_facing', v)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    form.internet_facing === v
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {v ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">System Owner</label>
            <input className={INPUT_CLS} value={form.owner} maxLength={200}
              onChange={e => set('owner', e.target.value)} placeholder="Owner name" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Team</label>
            <input className={INPUT_CLS} value={form.team} maxLength={200}
              onChange={e => set('team', e.target.value)} placeholder="Team name" />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SystemsDB() {
  const { currentUser } = useUser();
  const canEdit = currentUser?.role === 'tech_governance';

  const [SYSTEMS, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rmlFilter, setRmlFilter]   = useState('all');
  const [inetFilter, setInetFilter] = useState('all');
  const [sort, setSort] = useState({ field: 'crit', dir: 'asc' });
  const [selected, setSelected] = useState(null);

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

  function handleSaved(updated) {
    setSystems(prev => prev.map(s =>
      s.id === updated.id
        ? { ...s, ...updated, crit: updated.criticality, sens: updated.sensitivity, inet: updated.internet_facing }
        : s
    ));
    setSelected(null);
  }

  const rmls = ['all', 'High', 'Medium', 'Low'];

  const filtered = SYSTEMS
    .filter(s => {
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.owner || '').toLowerCase().includes(search.toLowerCase()) || (s.team || '').toLowerCase().includes(search.toLowerCase());
      const matchRml  = rmlFilter === 'all' || s.rml === rmlFilter;
      const matchInet = inetFilter === 'all' || (inetFilter === 'yes' ? s.inet : !s.inet);
      return matchSearch && matchRml && matchInet;
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
          {rmls.map(r => (
            <button
              key={r}
              onClick={() => setRmlFilter(r)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                rmlFilter === r ? 'bg-blue-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {r === 'all' ? 'All RML' : `RML: ${r}`}
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
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 9 : 8} className="py-12 text-center text-sm text-slate-400">No systems match your filters.</td>
                </tr>
              )}
              {filtered.map(s => (
                <tr key={s.name} className={`transition-colors ${canEdit ? 'hover:bg-slate-50 cursor-pointer' : 'hover:bg-slate-50'}`}
                  onClick={canEdit ? () => setSelected(s) : undefined}>
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
                  {canEdit && (
                    <td className="px-4 py-3.5 text-right" onClick={e => { e.stopPropagation(); setSelected(s); }}>
                      <button className="text-slate-400 hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-50">
                        <Pencil size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit panel */}
      {selected && (
        <EditPanel
          system={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
