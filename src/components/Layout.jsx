import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, PlusCircle, CheckSquare, BarChart2,
  Users, Database, BookOpen, Shield, Bell, Search, Menu, X, ChevronDown,
} from 'lucide-react';
import { useUser, ROLE_LABELS } from '../contexts/UserContext';

const NAV = [
  { to: '/',           label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/new',        label: 'New Risk',      icon: PlusCircle },
  { to: '/approvals',  label: 'My Approvals',  icon: CheckSquare },
  { to: '/workflow',   label: 'Workflow',       icon: Shield },
  { to: '/analytics',  label: 'Analytics',      icon: BarChart2 },
];

const ADMIN_NAV = [
  { to: '/admin/users',    label: 'Users & Roles', icon: Users },
  { to: '/admin/systems',  label: 'Systems DB',    icon: Database },
  { to: '/admin/practices',label: 'Best Practices',icon: BookOpen },
];

const ROLE_COLORS = {
  engineer:       'bg-blue-700',
  biz_owner:      'bg-emerald-600',
  security:       'bg-amber-600',
  tech_governance:'bg-cyan-700',
  grc_chair:      'bg-purple-700',
};

function NavItem({ to, label, icon: Icon, onClick }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-50 text-blue-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={18} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
          <span className="flex-1">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const { currentUser, users, switchUser, ROLE_LABELS } = useUser();

  const isFormPage = location.pathname.startsWith('/new') || location.pathname.startsWith('/risk/');
  const avatarColor = currentUser ? (ROLE_COLORS[currentUser.role] || 'bg-blue-700') : 'bg-blue-700';
  const initials = currentUser ? currentUser.name.split(' ').map(p => p[0]).join('').slice(0, 2) : '?';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center flex-shrink-0">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 leading-tight">RiskHub</div>
            <div className="text-xs text-slate-500 leading-tight">Ministry of Meetings</div>
          </div>
          <button
            className="ml-auto lg:hidden text-slate-400 hover:text-slate-600"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} onClick={() => setSidebarOpen(false)} />
          ))}

          <div className="pt-4 pb-1">
            <div className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Admin</div>
          </div>
          {ADMIN_NAV.map((item) => (
            <NavItem key={item.to} {...item} onClick={() => setSidebarOpen(false)} />
          ))}
        </nav>

        {/* User / Role switcher */}
        <div className="px-4 py-3 border-t border-slate-200 relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-3 w-full hover:bg-slate-50 rounded-lg p-1 -m-1 transition-colors"
          >
            <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-medium text-slate-900 truncate">{currentUser?.name || 'Select user'}</div>
              <div className="text-xs text-slate-500 truncate">
                {currentUser ? ROLE_LABELS[currentUser.role] : '—'} · {currentUser?.team || ''}
              </div>
            </div>
            <ChevronDown size={14} className={`text-slate-400 flex-shrink-0 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {userMenuOpen && (
            <div className="absolute bottom-full left-4 right-4 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                Switch user / role
              </div>
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => { switchUser(u.id); setUserMenuOpen(false); }}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors hover:bg-slate-50 ${
                    u.id === currentUser?.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full ${ROLE_COLORS[u.role] || 'bg-slate-400'} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {u.name.split(' ').map(p => p[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{u.name}</div>
                    <div className="text-xs text-slate-400 truncate">{ROLE_LABELS[u.role]}</div>
                  </div>
                  {u.id === currentUser?.id && (
                    <span className="text-xs text-blue-600 font-semibold">Active</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 h-14 bg-white border-b border-slate-200 flex items-center gap-4 px-4 lg:px-6">
          <button
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search risks, systems, owners…"
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-slate-400 transition"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {/* Current role chip */}
            {currentUser && (
              <span className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full text-white ${ROLE_COLORS[currentUser.role] || 'bg-slate-500'}`}>
                {ROLE_LABELS[currentUser.role]}
              </span>
            )}
            <button className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
