import { useState, useEffect } from 'react';
import { Search, BookOpen, ExternalLink, TrendingUp, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Badge, Card, PageHeader } from '../components/ui';

const AREA_STYLE = {
  'Authentication':    'bg-blue-50 text-blue-700 border-blue-200',
  'Network Exposure':  'bg-orange-50 text-orange-700 border-orange-200',
  'Risk Descriptions': 'bg-purple-50 text-purple-700 border-purple-200',
  'Residual Scoring':  'bg-amber-50 text-amber-700 border-amber-200',
  'Internet Facing':   'bg-red-50 text-red-700 border-red-200',
  'Justification':     'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const SUMMARIES = {
  'BP-024': 'All internet-facing file transfer services must enforce multi-factor authentication for both human and service accounts. Compensating controls are not accepted as a substitute.',
  'BP-019': 'When MFA cannot be implemented immediately, a time-boxed compensating control must be documented with a remediation deadline no more than 90 days out. IP allowlisting alone is insufficient.',
  'BP-007': 'Risk statements must follow the Cause → Event → Consequence structure. Vague event-only statements ("there is a risk of breach") are not accepted by the Cyber review stage.',
  'BP-031': 'Each mitigation must include an effectiveness rating (Low / Medium / High / Complete) based on the NIST 800-53 control maturity scale. Unrated mitigations default to Low.',
  'BP-042': 'Internet-exposed assets must use a minimum Likelihood score of 3 when calculating inherent risk, regardless of current incident history. This floor applies to all 5 exposure categories.',
  'BP-013': 'Accepting a residual risk rated Medium or above requires: documented owner sign-off, rationale for acceptance vs. mitigation, and a review date within 12 months.',
};

function AcceptanceBar({ accepted, used }) {
  const pct = used > 0 ? Math.round((accepted / used) * 100) : 0;
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-600 w-9 text-right">{pct}%</span>
    </div>
  );
}

function BPCard({ bp }) {
  const areaStyle = AREA_STYLE[bp.area] || 'bg-slate-50 text-slate-500 border-slate-200';
  const pct = bp.used_count > 0 ? Math.round((bp.accepted_count / bp.used_count) * 100) : 0;

  return (
    <Card className="flex flex-col gap-3 h-full">
      <div className="flex items-start justify-between gap-2">
        <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${areaStyle}`}>
          {bp.area}
        </span>
        <span className="font-mono text-xs text-slate-400">{bp.id}</span>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900 leading-snug mb-1.5">{bp.topic}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{SUMMARIES[bp.id]}</p>
      </div>

      <div className="mt-auto space-y-2.5 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1"><TrendingUp size={11} /> Used in {bp.used_count} assessments</span>
          <span className="flex items-center gap-1"><CheckCircle size={11} className="text-emerald-500" /> {bp.accepted_count} accepted</span>
        </div>
        <AcceptanceBar accepted={bp.accepted_count} used={bp.used_count} />
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Acceptance rate</span>
          <Link
            to="/analytics"
            className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
          >
            See related RAs <ExternalLink size={10} />
          </Link>
        </div>
      </div>
    </Card>
  );
}

export default function BestPractices() {
  const [bps, setBps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');

  useEffect(() => {
    api.getBestPractices()
      .then(setBps)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const areas = ['all', ...Object.keys(AREA_STYLE)];

  const filtered = bps.filter(bp => {
    const matchSearch = !search || bp.id.includes(search.toUpperCase()) || bp.topic.toLowerCase().includes(search.toLowerCase()) || bp.area.toLowerCase().includes(search.toLowerCase());
    const matchArea = areaFilter === 'all' || bp.area === areaFilter;
    return matchSearch && matchArea;
  });

  const totalUsed = bps.reduce((s, bp) => s + (bp.used_count || 0), 0);
  const totalAccepted = bps.reduce((s, bp) => s + (bp.accepted_count || 0), 0);
  const overallPct = totalUsed > 0 ? Math.round((totalAccepted / totalUsed) * 100) : 0;
  const mostUsed = [...bps].sort((a, b) => (b.used_count || 0) - (a.used_count || 0))[0];
  const BEST_PRACTICES = bps;

  return (
    <>
      <PageHeader
        title="Best Practices Library"
        subtitle={`${BEST_PRACTICES.length} guidelines · ${overallPct}% overall acceptance rate`}
      />

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total guidelines',      value: BEST_PRACTICES.length },
          { label: 'Total applications',    value: totalUsed },
          { label: 'Accepted suggestions',  value: totalAccepted },
          { label: 'Overall acceptance',    value: `${overallPct}%`, accent: true },
        ].map(({ label, value, accent }) => (
          <Card key={label} className="text-center">
            <div className={`text-2xl font-bold mb-0.5 ${accent ? 'text-blue-700' : 'text-slate-800'}`}>{value}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </Card>
        ))}
      </div>

      {/* Most-used callout */}
      {mostUsed && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6 text-sm">
          <BookOpen size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-blue-800">
            <strong>{mostUsed.id}</strong> is the most frequently applied guideline with {mostUsed.used} applications —
            the Cause–Event–Consequence structure has become standard practice across teams.
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by ID, topic, area…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {areas.map(a => (
            <button
              key={a}
              onClick={() => setAreaFilter(a)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                areaFilter === a ? 'bg-blue-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {a === 'all' ? 'All areas' : a}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <Card className="py-12 text-center">
          <BookOpen size={36} className="text-slate-300 mx-auto mb-3" />
          <div className="text-sm text-slate-400">No guidelines match your search.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(bp => <BPCard key={bp.id} bp={bp} />)}
        </div>
      )}

      {/* Footer note */}
      <div className="mt-8 text-xs text-slate-400 text-center">
        Guidelines are maintained by the GRC Council. To propose a new guideline or flag an outdated one, contact <span className="text-blue-500">grc@mom.gov.sg</span>.
      </div>
    </>
  );
}
