import { useState, useEffect } from 'react';
import { Search, BookOpen, ChevronDown, ChevronRight, Globe, Lock } from 'lucide-react';
import { api } from '../lib/api';
import { Card, PageHeader, RiskBadge } from '../components/ui';

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
  'BP-007': 'Risk descriptions must follow the Cause → Event → Consequence structure. Vague event-only statements ("there is a risk of breach") are not accepted by the Cyber review stage.',
  'BP-031': 'Each mitigation must include an effectiveness rating (Low / Medium / High / Complete) based on the NIST 800-53 control maturity scale. Unrated mitigations default to Low.',
  'BP-042': 'Internet-exposed assets must use a minimum Likelihood score of 3 when calculating inherent risk, regardless of current incident history. This floor applies to all 5 exposure categories.',
  'BP-013': 'Accepting a residual risk rated Medium or above requires: documented owner sign-off, rationale for acceptance vs. mitigation, and a review date within 12 months.',
};

function BPCard({ bp }) {
  const areaStyle = AREA_STYLE[bp.area] || 'bg-slate-50 text-slate-500 border-slate-200';
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
        <p className="text-xs text-slate-500 leading-relaxed">{SUMMARIES[bp.id] || bp.content?.split('\n')[0]}</p>
      </div>
    </Card>
  );
}

// --- Sample Risk Acceptances ---

const SAMPLES = [
  {
    id: 'SA-001',
    title: 'Vendor SFTP Gateway — Shared SSH Key Without Rotation Policy',
    system: 'Vendor SFTP Gateway',
    rml: 'High',
    internetFacing: true,
    level: 'High',
    impact: 5, likelihood: 4,
    residualImpact: 3, residualLikelihood: 2,
    residualLevel: 'Low',
    riskDescription:
      'Because the Vendor SFTP Gateway authenticates all 12 external payment vendor connections using a single shared SSH key pair that has not been rotated in 18 months and has no automated rotation schedule, a threat actor who obtains the private key through vendor endpoint compromise or supply-chain attack could authenticate as a legitimate vendor at any time and exfiltrate or tamper with regulated payment settlement files (full PANs, BSB/account numbers), resulting in a PCI-DSS breach and financial fraud exposure with mandatory regulatory notification obligations.',
    mitigations: [
      { text: 'Rotate existing SSH keys immediately and issue per-vendor unique key pairs', owner: 'DevOps Team', due: 'Jun 30', type: 'preventive' },
      { text: 'Enforce mandatory 90-day key rotation via automated provisioning pipeline', owner: 'DevOps Team', due: 'Jul 31', type: 'preventive' },
      { text: 'Implement per-vendor IP allowlisting with documented CIDR ranges and monthly review', owner: 'Network Ops', due: 'Jun 30', type: 'preventive' },
      { text: 'Enable audit logging of all SFTP sessions including filenames, sizes, and source IPs', owner: 'DevOps Team', due: 'Jun 20', type: 'detective' },
      { text: 'Automated P1 alert on any SFTP authentication from outside allowlisted IP ranges', owner: 'SOC', due: 'Jul 15', type: 'detective' },
    ],
    justification:
      'Data classification: PCI-DSS Restricted — settlement files contain full PANs and routing numbers. Named owner: Jordan Walsh (Payments BU). Per-vendor SSH keys with 90-day rotation minimise dwell time from any single key compromise; IP allowlisting limits authentication surface to known vendor endpoints. Monitoring KPIs: (1) SFTP session volume deviation >20% from baseline triggers P2 SOC review; (2) any authentication from outside allowlisted IPs triggers P1 incident response. Reassessment: Jan 2027 or immediately following any vendor security incident. Business rationale: Migration to certificate-based mTLS is planned for H1 2027; per-vendor keys and IP allowlisting are adequate interim controls given the scheduled permanent fix.',
  },
  {
    id: 'SA-002',
    title: 'HR Workday — Bulk Employee Data Export Without Audit Trail',
    system: 'HR Workday',
    rml: 'Medium',
    internetFacing: false,
    level: 'Medium',
    impact: 4, likelihood: 3,
    residualImpact: 3, residualLikelihood: 2,
    residualLevel: 'Low',
    riskDescription:
      'Because HR Workday grants bulk CSV export permissions to all 47 HR Business Partners and HR Managers without volume restrictions or export event logging, any HR role with legitimate system access can silently extract full salary, performance rating, and personal data records for all 3,400 Ministry employees without triggering any alert or audit event, resulting in potential insider-threat data exfiltration or accidental data leak with PDPA notification obligations under the Personal Data Protection Act.',
    mitigations: [
      { text: 'Enable Workday audit logging for all bulk export events exceeding 100 records', owner: 'IT Ops', due: 'Jun 20', type: 'detective' },
      { text: 'Restrict bulk export capability to HR-Director role and above (reduces scope from 47 to ~8 users)', owner: 'IT Ops', due: 'Jul 15', type: 'preventive' },
      { text: 'DLP rule: alert SOC when any session exports more than 500 employee records', owner: 'SOC', due: 'Jul 31', type: 'detective' },
      { text: 'Quarterly export log review by HRBP and Privacy Officer', owner: 'HR Ops', due: 'Ongoing', type: 'detective' },
    ],
    justification:
      'Data classification: Confidential — salary bands, performance ratings, and NRIC-linked personal data; PDPA-protected. Named owner: Marcus Webb (People Ops). Restricting export capability to HR-Director tier reduces insider-threat surface from 47 to approximately 8 users. Audit logging and DLP alerting provide near-real-time visibility into anomalous extractions. Monitoring KPIs: (1) any bulk export >500 records triggers P2 SOC review within 2 hours; (2) quarterly audit log review completed on schedule with zero unexplained exports. Reassessment: After export restriction go-live (Aug 2026) and annually thereafter. Business rationale: HR operations require export capability for payroll processing and statutory reporting; restricting to senior HR roles balances operational necessity with data minimisation principles under the PDPA.',
  },
  {
    id: 'SA-003',
    title: 'Internal Wiki — Ex-Employee Accounts Not Revoked Within Policy SLA',
    system: 'Internal Wiki',
    rml: 'Low',
    internetFacing: false,
    level: 'Low',
    impact: 2, likelihood: 3,
    residualImpact: 1, residualLikelihood: 2,
    residualLevel: 'Very Low',
    riskDescription:
      'Because the Internal Wiki deprovisioning process relies on quarterly manual audits rather than automated integration with HR offboarding, ex-employee accounts retain read access to the Internal Wiki for an average of 45 days post-departure — in violation of the 7-day access revocation policy — enabling ex-employees to access internal process documentation, team playbooks, escalation procedures, and organisational charts, resulting in potential exposure of internal operational procedures that could be used for social engineering or competitive intelligence.',
    mitigations: [
      { text: 'Automate wiki account deactivation via SCIM provisioning on HR offboarding event', owner: 'IT Ops', due: 'Aug 31', type: 'preventive' },
      { text: 'Monthly manual reconciliation of active wiki accounts against current employee list (interim, until SCIM live)', owner: 'IT Ops', due: 'Ongoing', type: 'detective' },
      { text: 'Annual wiki content audit to identify and reclassify any Restricted content incorrectly stored on the wiki', owner: 'IT Ops', due: 'Ongoing', type: 'detective' },
    ],
    justification:
      'Data classification: Internal — wiki contains only Internal-classified process documentation per current content audit; no Restricted or Confidential data is stored on the wiki. Named owner: Anita Cole (IT Ops). SCIM integration eliminates the deprovisioning gap permanently; monthly manual reconciliation provides adequate interim coverage. Monitoring KPIs: (1) zero active ex-employee accounts post-SCIM go-live (validated in quarterly spot checks); (2) monthly reconciliation completed on schedule. Reassessment: After SCIM integration go-live (Q4 2026). Business rationale: Risk level is Low with Internal-only content; the remediation (SCIM integration) is scheduled within the normal infrastructure sprint cycle and carries no operational disruption.',
  },
];

function SampleCard({ sample }) {
  const [open, setOpen] = useState(false);

  const scoreLabel = (impact, likelihood) => {
    const s = impact * likelihood;
    const level = s >= 15 ? 'High' : s >= 9 ? 'Medium' : s >= 4 ? 'Low' : 'Very Low';
    return `${s} (${level})`;
  };

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-xs text-slate-400">{sample.id}</span>
              <RiskBadge level={sample.level} />
              {sample.internetFacing
                ? <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5"><Globe size={10} /> Internet-facing</span>
                : <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5"><Lock size={10} /> Internal</span>
              }
            </div>
            <h3 className="text-sm font-semibold text-slate-900 leading-snug">{sample.title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{sample.system} · RML: {sample.rml}</p>
          </div>
          <div className="text-slate-400 mt-1 shrink-0">
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </div>

        <div className="flex gap-4 mt-2.5 text-xs text-slate-600">
          <span>Inherent: <strong className="text-slate-800">I:{sample.impact} × L:{sample.likelihood} = {scoreLabel(sample.impact, sample.likelihood)}</strong></span>
          <span className="text-slate-300">|</span>
          <span>Residual: <strong className="text-slate-800">I:{sample.residualImpact} × L:{sample.residualLikelihood} = {scoreLabel(sample.residualImpact, sample.residualLikelihood)}</strong></span>
        </div>
      </button>

      {open && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Risk Description</div>
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-3">{sample.riskDescription}</p>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Mitigations ({sample.mitigations.length})</div>
            <div className="space-y-1.5">
              {sample.mitigations.map((m, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${
                    m.type === 'preventive' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                  }`}>{m.type}</span>
                  <span className="text-slate-700 flex-1">{m.text} <span className="text-slate-400">— {m.owner}, {m.due}</span></span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Justification</div>
            <p className="text-xs text-slate-700 leading-relaxed bg-emerald-50 border border-emerald-100 rounded-lg p-3">{sample.justification}</p>
          </div>
        </div>
      )}
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

  return (
    <>
      <PageHeader
        title="Best Practices Library"
        subtitle={`${bps.length} GRC guidelines · ${SAMPLES.length} sample risk acceptances`}
      />

      {/* ── GRC Guidelines ── */}
      <h2 className="text-sm font-semibold text-slate-700 mb-3">GRC Guidelines</h2>

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

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card className="py-12 text-center">
          <BookOpen size={36} className="text-slate-300 mx-auto mb-3" />
          <div className="text-sm text-slate-400">No guidelines match your search.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(bp => <BPCard key={bp.id} bp={bp} />)}
        </div>
      )}

      {/* ── Sample Risk Acceptances ── */}
      <div className="mt-10 mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Sample Risk Acceptances</h2>
          <p className="text-xs text-slate-400 mt-0.5">Reference examples showing well-structured risk assessments across different risk levels. Click to expand.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {SAMPLES.map(s => <SampleCard key={s.id} sample={s} />)}
      </div>

      <div className="mt-8 text-xs text-slate-400 text-center">
        Guidelines maintained by the GRC Council. To propose a new guideline or flag an outdated one, contact <span className="text-blue-500">grc@meetings.gov.sg</span>.
      </div>
    </>
  );
}
