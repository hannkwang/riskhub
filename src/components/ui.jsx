// Shared UI primitives

export function Badge({ variant = 'default', size = 'sm', children, className = '' }) {
  const base = 'inline-flex items-center font-medium rounded-full';
  const sizes = { xs: 'px-2 py-0.5 text-xs', sm: 'px-2.5 py-0.5 text-xs', md: 'px-3 py-1 text-sm' };
  const variants = {
    default:  'bg-slate-100 text-slate-700',
    primary:  'bg-blue-100 text-blue-800',
    success:  'bg-emerald-100 text-emerald-800',
    warning:  'bg-amber-100 text-amber-800',
    danger:   'bg-red-100 text-red-800',
    info:     'bg-sky-100 text-sky-800',
    outline:  'bg-white border border-slate-300 text-slate-600',
    'draft':         'bg-slate-100 text-slate-600',
    'cyber-review':  'bg-amber-100 text-amber-800',
    'governance':    'bg-blue-100 text-blue-800',
    'approved':      'bg-emerald-100 text-emerald-800',
    'rejected':      'bg-red-100 text-red-800',
    'biz-review':    'bg-purple-100 text-purple-800',
  };
  return (
    <span className={`${base} ${sizes[size]} ${variants[variant] ?? variants.default} ${className}`}>
      {children}
    </span>
  );
}

export function RiskBadge({ level }) {
  const map = { High: 'danger', Medium: 'warning', Low: 'success' };
  return <Badge variant={map[level] ?? 'default'}>{level}</Badge>;
}

// Single source of truth for score → level thresholds (mirrors the server-side
// computeLevel in routes/risks.js): Very Low <4, Low 4–8, Medium 9–14, High ≥15.
export function riskLevel(score) {
  if (score >= 15) return 'High';
  if (score >= 9)  return 'Medium';
  if (score >= 4)  return 'Low';
  return 'Very Low';
}

// Shared 5×5 risk matrix. `className` styles the wrapper ('' = block, like the
// New Risk form; 'inline-block' to shrink-wrap, as on the samples page).
export function RiskMatrix({ impact, likelihood, className = '' }) {
  const cellColor = (i, l) => {
    const v = i * l;
    if (v >= 15) return '#fca5a5';
    if (v >= 9)  return '#fcd34d';
    if (v >= 4)  return '#fef9c3';
    return '#bbf7d0';
  };
  return (
    <div className={className}>
      <div className="grid gap-px bg-slate-200 rounded overflow-hidden" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {[5,4,3,2,1].map((i) =>
          [1,2,3,4,5].map((l) => {
            const sel = i === impact && l === likelihood;
            return (
              <div key={`${i}-${l}`} className="w-7 h-6 flex items-center justify-center text-xs font-bold transition-transform"
                style={{ background: sel ? '#1d4ed8' : cellColor(i, l), color: sel ? 'white' : '#374151',
                  transform: sel ? 'scale(1.15)' : 'scale(1)', zIndex: sel ? 1 : 0,
                  position: 'relative', borderRadius: sel ? '3px' : undefined }}>
                {sel ? i * l : ''}
              </div>
            );
          })
        )}
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-1">
        <span>← Likelihood →</span>
        <span className="font-mono">{impact} × {likelihood} = {impact * likelihood}</span>
      </div>
    </div>
  );
}

export function StageBadge({ stage }) {
  const map = {
    'Draft':             'draft',
    'System Owner':      'biz-review',
    'Concurrent Review': 'cyber-review',
    'Approved':          'approved',
    'Rejected':          'rejected',
    // Legacy names kept for any stale history rows
    'Biz Owner':         'biz-review',
    'Cyber Review':      'cyber-review',
    'Governance':        'governance',
  };
  return <Badge variant={map[stage] ?? 'default'}>{stage}</Badge>;
}

export function Avatar({ initials, size = 'sm', color = 'blue' }) {
  const sizes = { xs: 'w-6 h-6 text-xs', sm: 'w-8 h-8 text-sm', md: 'w-9 h-9 text-sm', lg: 'w-10 h-10 text-base' };
  const colors = {
    blue:   'bg-blue-600 text-white',
    indigo: 'bg-indigo-600 text-white',
    violet: 'bg-violet-600 text-white',
    amber:  'bg-amber-500 text-white',
    emerald:'bg-emerald-600 text-white',
    rose:   'bg-rose-600 text-white',
    slate:  'bg-slate-500 text-white',
  };
  const palette = ['blue','indigo','violet','amber','emerald','rose','slate'];
  const auto = palette[(initials?.charCodeAt(0) ?? 0) % palette.length];
  return (
    <div className={`${sizes[size]} ${colors[color] ?? colors[auto]} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

export function Button({ variant = 'primary', size = 'md', children, className = '', ...props }) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
  const sizes = {
    xs: 'px-2.5 py-1 text-xs gap-1',
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2',
  };
  const variants = {
    primary:  'bg-blue-700 text-white hover:bg-blue-800 focus:ring-blue-500',
    secondary:'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-400',
    ghost:    'bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-slate-400',
    danger:   'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    'danger-ghost': 'bg-transparent text-red-600 border border-red-300 hover:bg-red-50 focus:ring-red-400',
    success:  'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant] ?? variants.primary} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Card({ children, className = '', padding = true }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${padding ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function Divider({ className = '' }) {
  return <div className={`border-t border-slate-200 ${className}`} />;
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400 ${className}`}
      {...props}
    />
  );
}

export function Select({ children, className = '', ...props }) {
  return (
    <select
      className={`px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400 resize-none ${className}`}
      {...props}
    />
  );
}

export function KpiCard({ label, value, sub, trend, trendOk, icon: Icon, accent = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-5 rounded-xl border shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${
        accent ? 'bg-blue-700 border-blue-600 text-white' : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between mb-1">
        <div className={`text-3xl font-bold tracking-tight ${accent ? 'text-white' : 'text-slate-900'}`}>{value}</div>
        {Icon && <Icon size={20} className={accent ? 'text-blue-200' : 'text-slate-400'} />}
      </div>
      <div className={`text-sm font-medium ${accent ? 'text-blue-100' : 'text-slate-700'}`}>{label}</div>
      {sub && <div className={`text-xs mt-0.5 ${accent ? 'text-blue-200' : 'text-slate-500'}`}>{sub}</div>}
      {trend && (
        <div className={`text-xs mt-2 font-semibold ${
          trendOk
            ? accent ? 'text-blue-200' : 'text-emerald-600'
            : accent ? 'text-red-200' : 'text-red-600'
        }`}>{trend}</div>
      )}
    </button>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="py-16 flex flex-col items-center text-center gap-3">
      {Icon && <Icon size={40} className="text-slate-300" />}
      <div className="text-base font-semibold text-slate-600">{title}</div>
      {body && <div className="text-sm text-slate-400 max-w-xs">{body}</div>}
    </div>
  );
}

export function Tooltip({ text, children }) {
  return (
    <span className="relative group">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
        {text}
      </span>
    </span>
  );
}
