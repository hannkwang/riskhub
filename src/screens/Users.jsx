import { useState, useEffect, useMemo } from 'react';
import {
  Search, UserPlus, MoreHorizontal,
  Mail, ChevronDown, X, Check, AlertCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { Badge, Avatar, Button, Card, PageHeader } from '../components/ui';

const ROLE_COLORS = {
  'engineer':       'blue',
  'biz_owner':      'purple',
  'security':       'amber',
  'tech_governance':'cyan',
  'grc_chair':      'green',
};

const ROLE_LABELS_MAP = {
  'engineer':       'Engineer',
  'biz_owner':      'System Owner',
  'security':       'Cyber Security',
  'tech_governance':'Tech Governance Assurance',
  'grc_chair':      'GRC Co-Chair',
};

const PERMISSIONS = {
  'engineer':       { submit: true,  comment: true,  review: false, approve: false, admin: false },
  'biz_owner':      { submit: false, comment: true,  review: true,  approve: true,  admin: false },
  'security':       { submit: false, comment: true,  review: true,  approve: true,  admin: false },
  'tech_governance':{ submit: false, comment: true,  review: true,  approve: true,  admin: true  },
  'grc_chair':      { submit: false, comment: true,  review: true,  approve: true,  admin: true  },
};

function RoleBadge({ role }) {
  const color = ROLE_COLORS[role] || 'slate';
  const classes = {
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    slate:  'bg-slate-100 text-slate-600 border-slate-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    amber:  'bg-amber-50 text-amber-700 border-amber-200',
    cyan:   'bg-cyan-50 text-cyan-700 border-cyan-200',
    green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  }[color] || 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${classes}`}>
      {ROLE_LABELS_MAP[role] || role}
    </span>
  );
}

function StatusDot({ status }) {
  if (status === 'active') {
    return <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Active</span>;
  }
  return <span className="inline-flex items-center gap-1 text-xs text-amber-600"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> Invited</span>;
}

function PermissionRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0 cursor-pointer">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  );
}

function EditPanel({ user, onClose, onSaved, allSystems }) {
  const [editName, setEditName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [editTeamText, setEditTeamText] = useState(user.team || '');
  // For biz_owner: IDs of systems currently owned by this user
  const [selectedSysIds, setSelectedSysIds] = useState(
    () => allSystems.filter(s => s.owner === user.name).map(s => s.id)
  );
  const [perms, setPerms] = useState({ ...(PERMISSIONS[user.role] || {}) });
  const [saved, setSaved] = useState(false);

  // Track which systems were originally owned by this user
  const originalSysIds = allSystems.filter(s => s.owner === user.name).map(s => s.id);

  function handleRoleChange(newRole) {
    setRole(newRole);
    setPerms({ ...(PERMISSIONS[newRole] || {}) });
  }

  function toggleSys(id) {
    setSelectedSysIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const isBizOwner = role === 'biz_owner';

  async function save() {
    try {
      const body = { name: editName, role };
      if (!isBizOwner) body.team = editTeamText.trim();
      const updated = await api.updateUser(user.id, body);

      if (isBizOwner) {
        const newName = updated.name;
        for (const sys of allSystems) {
          const wasOwned = originalSysIds.includes(sys.id);
          const nowOwned = selectedSysIds.includes(sys.id);
          if (!wasOwned && nowOwned) await api.updateSystem(sys.id, { owner: newName });
          else if (wasOwned && !nowOwned) await api.updateSystem(sys.id, { owner: '' });
        }
      }

      onSaved?.(updated);
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 800);
    } catch (e) {
      alert(`Save failed: ${e.message}`);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-96 bg-white h-full shadow-2xl flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <Avatar initials={user.initials} size="md" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900">{user.name}</div>
            <div className="text-xs text-slate-500 truncate">{user.email}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Role */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Role</label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
              >
                {Object.entries(ROLE_LABELS_MAP).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Systems (biz_owner) or Team (everyone else) */}
          {isBizOwner ? (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                Systems Owned
                <span className="normal-case font-normal ml-1 text-slate-400">(select all that apply)</span>
              </label>
              <div className="space-y-1.5">
                {allSystems.map(s => (
                  <label key={s.id} className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedSysIds.includes(s.id)}
                      onChange={() => toggleSys(s.id)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="text-sm text-slate-700 group-hover:text-slate-900">{s.name}</div>
                      <div className="text-xs text-slate-400">{s.team} · {s.criticality}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Team</label>
              <input
                type="text"
                value={editTeamText}
                onChange={(e) => setEditTeamText(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Permissions */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Permissions</label>
            <Card padding={false} className="px-4 divide-y divide-slate-100">
              <PermissionRow label="Submit risk assessments"    checked={perms.submit}  onChange={() => setPerms(p => ({ ...p, submit:  !p.submit  }))} />
              <PermissionRow label="Comment on assessments"     checked={perms.comment} onChange={() => setPerms(p => ({ ...p, comment: !p.comment }))} />
              <PermissionRow label="Review in workflow"         checked={perms.review}  onChange={() => setPerms(p => ({ ...p, review:  !p.review  }))} />
              <PermissionRow label="Approve & route"            checked={perms.approve} onChange={() => setPerms(p => ({ ...p, approve: !p.approve }))} />
              <PermissionRow label="Admin access"               checked={perms.admin}   onChange={() => setPerms(p => ({ ...p, admin:   !p.admin   }))} />
            </Card>
          </div>

          {/* Danger zone */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Danger Zone</label>
            <Card className="border-red-100">
              <p className="text-xs text-slate-500 mb-3">Deactivating removes all active sessions. The user will no longer be able to log in. Their existing risk assessments remain intact.</p>
              <button className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors">
                Deactivate {editName.split(' ')[0]}'s account →
              </button>
            </Card>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={save}>
            {saved ? <><Check size={14} /> Saved</> : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function InviteModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Application Team');
  const [sent, setSent] = useState(false);

  function send() {
    if (!email) return;
    setSent(true);
    setTimeout(() => { setSent(false); onClose(); }, 900);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <Card className="relative w-full max-w-sm z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">Invite user</h3>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Email address</label>
            <input
              type="email"
              placeholder="name@meetings.gov"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Role</label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 pr-8 appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(ROLE_LABELS_MAP).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            An invitation email will be sent from noreply@meetings.gov
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={send}>
            {sent ? <><Check size={14} /> Sent!</> : <><Mail size={14} /> Send invite</>}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function enrichUser(u) {
  return {
    ...u,
    email: `${u.name.toLowerCase().replace(/ /g, '.')}@meetings.gov`,
    initials: u.name.split(' ').map(p => p[0]).join('').slice(0, 2),
    status: u.active ? 'active' : 'invited',
    last: '—',
  };
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [allSystems, setAllSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    Promise.all([api.getUsers(), api.getSystems()])
      .then(([userRows, sysRows]) => {
        setUsers(userRows.map(enrichUser));
        setAllSystems(sysRows);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function handleSaved(updated) {
    const enriched = enrichUser(updated);
    setUsers(prev => prev.map(u => u.id === updated.id ? enriched : u));
    // Re-fetch systems to reflect ownership changes
    api.getSystems().then(setAllSystems).catch(console.error);
    setEditing(null);
  }

  // Map owner name → systems they own (for table display)
  const systemsByOwner = useMemo(() => {
    const map = {};
    for (const s of allSystems) {
      if (!s.owner) continue;
      (map[s.owner] = map[s.owner] || []).push(s);
    }
    return map;
  }, [allSystems]);

  const roles = ['all', ...Object.keys(ROLE_COLORS)];

  const filtered = users.filter(u => {
    const ownedNames = (systemsByOwner[u.name] || []).map(s => s.name);
    const matchSearch = !search
      || u.name.toLowerCase().includes(search.toLowerCase())
      || u.email.includes(search.toLowerCase())
      || (u.team || '').toLowerCase().includes(search.toLowerCase())
      || ownedNames.some(n => n.toLowerCase().includes(search.toLowerCase()));
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <>
      <PageHeader
        title="Users & Roles"
        subtitle={`${users.length} users · ${users.filter(u => u.status === 'active').length} active`}
        actions={
          <Button onClick={() => setInviting(true)}>
            <UserPlus size={14} /> Invite user
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {roles.map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                roleFilter === r ? 'bg-blue-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {r === 'all' ? `All (${users.length})` : r}
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
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">User</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Role</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Team / Systems</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Last active</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-slate-400">No users match your search.</td>
                </tr>
              )}
              {filtered.map(u => (
                <tr key={u.email} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar initials={u.initials} size="sm" />
                      <div>
                        <div className="font-medium text-slate-900">{u.name}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    {u.role === 'biz_owner' ? (
                      <div className="flex flex-wrap gap-1">
                        {(systemsByOwner[u.name] || []).length > 0
                          ? (systemsByOwner[u.name]).map(s => (
                              <span key={s.id} className="inline-block text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">{s.name}</span>
                            ))
                          : <span className="text-xs text-slate-400">No systems</span>
                        }
                      </div>
                    ) : (
                      <span className="text-slate-600">{u.team || '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell"><StatusDot status={u.status} /></td>
                  <td className="px-4 py-3.5 text-slate-400 hidden lg:table-cell">{u.last}</td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => setEditing(u)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Role legend */}
      <div className="mt-6">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Role permissions summary</div>
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Role</th>
                  {['Submit RA', 'Comment', 'Review', 'Approve', 'Admin'].map(h => (
                    <th key={h} className="text-center font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(PERMISSIONS).map(([role, perms]) => (
                  <tr key={role} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5"><RoleBadge role={role} /></td>
                    {[perms.submit, perms.comment, perms.review, perms.approve, perms.admin].map((v, i) => (
                      <td key={i} className="text-center px-3 py-2.5">
                        {v
                          ? <Check size={13} className="text-emerald-500 mx-auto" />
                          : <span className="text-slate-300 text-sm">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {editing && <EditPanel user={editing} onClose={() => setEditing(null)} onSaved={handleSaved} allSystems={allSystems} />}
      {inviting && <InviteModal onClose={() => setInviting(false)} />}
    </>
  );
}
