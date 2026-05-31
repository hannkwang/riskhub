import { useState } from 'react';
import { ChevronDown, ChevronRight, Globe, Lock, Info } from 'lucide-react';
import { PageHeader, RiskBadge, RiskMatrix, riskLevel as scoreLevel } from '../components/ui';

// ── Sample data ───────────────────────────────────────────────────────────────
const SAMPLES = [
  {
    id: 'SA-001',
    title: 'Mobile Banking App — Jailbroken Device Detection Bypass Enabling Session Token Extraction',
    system: 'Mobile Banking App',
    rml: 'High',
    internetFacing: true,
    impact: 5, likelihood: 3,
    residualImpact: 3, residualLikelihood: 2,
    riskDescription:
      'Because the Mobile Banking App does not implement runtime application self-protection (RASP) or enforce jailbreak/root detection at the OS level, an attacker on a jailbroken or rooted device could use a memory-hooking tool (e.g. Frida) to extract session tokens and authentication certificates directly from the app\'s runtime memory, resulting in full account takeover and fraudulent fund transfers for all 2.3 million retail banking customers without requiring the user\'s PIN or biometric.',
    mitigations: [
      { type: 'preventive', text: 'Integrate RASP SDK (e.g. Guardsquare) with runtime jailbreak/root detection — terminate session on detection', owner: 'Mira Tanaka', due: 'Jul 31' },
      { type: 'preventive', text: 'Enforce certificate pinning for all API calls to prevent MITM interception on compromised devices', owner: 'Mira Tanaka', due: 'Jul 31' },
      { type: 'preventive', text: 'Store session tokens in iOS Secure Enclave / Android Keystore — never in app memory or storage', owner: 'Sam Okafor', due: 'Aug 15' },
      { type: 'detective',  text: 'Fraud analytics: flag logins from device fingerprints not matching prior session history; trigger step-up authentication', owner: 'Yih Wen Tsai', due: 'Aug 31' },
    ],
    justification:
      'Data classification: PCI-DSS Restricted — session tokens grant access to full account balance, transaction history, and fund transfer capability. Named owner: Sara Lin (Retail BU). RASP integration and Keystore-backed token storage eliminate the root cause by making runtime extraction computationally infeasible. Certificate pinning removes the MITM attack surface on jailbroken devices. Monitoring KPIs: (1) RASP detection events logged and reviewed weekly — zero tolerance for bypassed sessions; (2) fraud analytics step-up challenge rate monitored daily. Reassessment: post-RASP deployment (Sep 2026) and annually. Business rationale: RASP integration adds <5ms latency overhead per session; security uplift justifies the minor performance cost given the customer base size and financial exposure.',
  },
  {
    id: 'SA-002',
    title: 'Payments Gateway — Legacy TLS 1.0/1.1 Protocols Still Accepted on Payment API Endpoints',
    system: 'Payments Gateway',
    rml: 'High',
    internetFacing: true,
    impact: 5, likelihood: 3,
    residualImpact: 2, residualLikelihood: 1,
    riskDescription:
      'Because the Payments Gateway API load balancer has not disabled TLS 1.0 and TLS 1.1 protocol support, an attacker capable of performing a downgrade negotiation (e.g. POODLE or BEAST attack) against a client connection could decrypt payment transaction traffic in transit, resulting in interception of full PANs, CVVs, and cardholder names during transaction processing — triggering PCI-DSS non-compliance and potential regulatory penalties exceeding SGD 2 million.',
    mitigations: [
      { type: 'preventive', text: 'Disable TLS 1.0 and TLS 1.1 on all Payments Gateway load balancer listeners; enforce TLS 1.2 minimum', owner: 'Devon Reyes', due: 'Jun 30' },
      { type: 'preventive', text: 'Configure HSTS with max-age ≥31536000 and preload directive on all payment endpoints', owner: 'Devon Reyes', due: 'Jun 30' },
      { type: 'preventive', text: 'Remove all weak cipher suites; retain only ECDHE+AES-GCM and CHACHA20-POLY1305', owner: 'Devon Reyes', due: 'Jun 30' },
      { type: 'detective',  text: 'Configure WAF to alert on TLS negotiation failures and protocol downgrade attempts', owner: 'Yih Wen Tsai', due: 'Jul 15' },
    ],
    justification:
      'Data classification: PCI-DSS Restricted — payment transaction data including full PANs and CVVs. Named owner: Jordan Walsh (Payments BU). Disabling legacy TLS protocols at the load balancer eliminates the downgrade attack surface entirely with zero functional impact, as all current PCI-compliant payment processors mandatorily support TLS 1.2+. No client compatibility regression expected — PCI-DSS 4.0 requires TLS 1.2 minimum as of March 2025. Monitoring KPIs: (1) automated TLS configuration scan (Qualys SSL Labs equivalent) run monthly — A rating required; (2) WAF protocol-downgrade alert count must remain zero. Reassessment: post-deployment verification by QSA during next PCI audit (Dec 2026). Business rationale: Configuration change only — no code changes, zero downtime, no vendor co-ordination required; risk of inaction (PCI non-compliance finding) far exceeds remediation cost.',
  },
  {
    id: 'SA-003',
    title: 'Identity Provider (SSO) — No Tested Disaster Recovery Procedure for Total SSO Outage',
    system: 'Identity Provider (SSO)',
    rml: 'High',
    internetFacing: true,
    impact: 5, likelihood: 2,
    residualImpact: 4, residualLikelihood: 1,
    riskDescription:
      'Because the Identity Provider (SSO) disaster recovery runbook has not been tested in 18 months and the break-glass account procedure relies on a single shared password stored in a physical safe accessible only to two named administrators, a prolonged SSO outage caused by infrastructure failure, ransomware, or accidental misconfiguration could block all 3,400 Ministry staff from accessing every critical system simultaneously, resulting in a complete operational standstill lasting 4–8 hours and violating the 2-hour RTO commitment in the Ministry\'s Business Continuity Plan.',
    mitigations: [
      { type: 'preventive', text: 'Conduct full DR failover test for SSO to standby region — document RTO achieved and remediate gaps', owner: 'Devon Reyes', due: 'Jul 31' },
      { type: 'preventive', text: 'Migrate break-glass credentials to CyberArk PAM vault — distribute recovery access to 5 named administrators across 3 teams', owner: 'Shan Wong', due: 'Jun 30' },
      { type: 'preventive', text: 'Implement active-active SSO configuration across two availability zones to eliminate single-node failure risk', owner: 'Devon Reyes', due: 'Sep 30' },
      { type: 'detective',  text: 'Set up synthetic monitoring: probe SSO authentication endpoint every 60s from external location; PagerDuty P1 alert within 2 minutes of failure', owner: 'Yih Wen Tsai', due: 'Jun 20' },
    ],
    justification:
      'Data classification: Not a data risk — this is an availability/resilience risk. Named owner: Sara Lin (Identity BU). Active-active deployment eliminates single-node failure; CyberArk migration ensures break-glass access is available without physical safe dependency. DR test validates the RTO commitment. Monitoring KPIs: (1) SSO availability SLA ≥99.9% measured monthly; (2) synthetic probe alert-to-acknowledge time <5 minutes in monthly drill. Reassessment: after active-active deployment (Oct 2026) and semi-annually thereafter per BCP policy. Business rationale: Full active-active infrastructure is a 2-sprint effort; residual risk remains Low-Medium until complete — accepted by IT leadership given the scheduled delivery timeline and synthetic monitoring providing early-warning coverage in the interim.',
  },
  {
    id: 'SA-004',
    title: 'K8s DEV Cluster — Production Database Credentials Committed to Internal Git Repository',
    system: 'K8s DEV Cluster',
    rml: 'Medium',
    internetFacing: false,
    impact: 4, likelihood: 3,
    residualImpact: 2, residualLikelihood: 1,
    riskDescription:
      'Because a developer committed a Kubernetes manifest file containing hardcoded production PostgreSQL credentials (hostname, username, and password) to the internal GitLab repository 6 weeks ago, and Git history is immutable without a force-push, any engineer with repository read access can retrieve active production database credentials, resulting in unauthorised direct access to the production customer transaction database — bypassing all application-layer access controls and audit logging.',
    mitigations: [
      { type: 'preventive', text: 'Immediately rotate the exposed production PostgreSQL password and revoke the old credential', owner: 'Devon Reyes', due: 'IMMEDIATE' },
      { type: 'preventive', text: 'Rewrite Git history using git-filter-repo to remove the credential from all commits; force-push to origin after team coordination', owner: 'Devon Reyes', due: 'Jun 15' },
      { type: 'preventive', text: 'Migrate all production credentials to HashiCorp Vault with dynamic secrets — no static credentials in manifests or code', owner: 'Devon Reyes', due: 'Jul 31' },
      { type: 'preventive', text: 'Enforce pre-commit hook and GitLab CI secret scanning (trufflehog) — block pushes containing credential patterns', owner: 'Lee Park', due: 'Jun 30' },
      { type: 'detective',  text: 'Audit PostgreSQL connection logs for the past 6 weeks — flag any direct connections from non-application IP ranges', owner: 'Yih Wen Tsai', due: 'Jun 10' },
    ],
    justification:
      'Data classification: Restricted — production PostgreSQL contains full customer transaction records and PII. Named owner: Devon Reyes (Cloud Infra). Immediate credential rotation stops active exposure; Git history rewrite removes the credential from all future clones. Vault migration prevents recurrence structurally. Secret scanning pre-commit hook creates a systematic barrier. Monitoring KPIs: (1) zero direct database connections from non-application subnets (monitored via PostgreSQL audit logs); (2) pre-commit hook block count reviewed weekly — any bypass treated as incident. Reassessment: after Vault migration go-live (Aug 2026). Business rationale: Credential rotation and Git rewrite are zero-cost operations completable within 48 hours; Vault migration is scheduled within the next sprint. No business disruption anticipated from credential rotation (rolling restart of affected pods only).',
  },
  {
    id: 'SA-005',
    title: 'HR Workday — Employee Performance Records Retained 3 Years Beyond Mandatory Deletion Policy',
    system: 'HR Workday',
    rml: 'Medium',
    internetFacing: false,
    impact: 2, likelihood: 3,
    residualImpact: 1, residualLikelihood: 2,
    riskDescription:
      'Because HR Workday lacks an automated data retention enforcement mechanism and the manual deletion process relies on HRBP discretion rather than a system-enforced schedule, performance review records, disciplinary notes, and salary progression data for ex-employees are being retained for up to 8 years — 3 years beyond the Ministry\'s 5-year maximum retention policy under the Personal Data Protection Act — resulting in unnecessary accumulation of PDPA-protected personal data that increases the organisation\'s regulatory exposure in the event of a data breach or PDPC audit.',
    mitigations: [
      { type: 'preventive', text: 'Configure Workday automated data retention policy: archive ex-employee records at 5 years, purge at 5 years + 6 months', owner: 'Lee Park', due: 'Aug 31' },
      { type: 'preventive', text: 'Conduct one-time bulk deletion of all ex-employee records exceeding the 5-year retention threshold', owner: 'Lee Park', due: 'Jul 15' },
      { type: 'detective',  text: 'Quarterly automated report: flag all records approaching or exceeding retention limit for HRBP review and sign-off', owner: 'Marcus Webb', due: 'Ongoing' },
    ],
    justification:
      'Data classification: Confidential — performance reviews, disciplinary records, salary bands, and NRIC-linked personal data for ex-employees. Named owner: Marcus Webb (People Ops). Workday retention policy automation removes the manual dependency entirely once configured. One-time bulk purge addresses the existing backlog. Quarterly report provides ongoing visibility as a backstop. Monitoring KPIs: (1) zero records exceeding 5-year retention threshold in quarterly audit; (2) Workday retention policy configuration reviewed annually by Privacy Officer. Reassessment: after automated retention go-live (Sep 2026). Business rationale: Risk level is Low — data is Internal-facing only with no current evidence of misuse. Retention automation is a Workday configuration item (no development effort); cost of non-compliance with PDPA retention limits (potential PDPC enforcement notice) outweighs the minimal implementation effort.',
  },
];

// ── Sample card ───────────────────────────────────────────────────────────────
function SampleCard({ sample, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const inherentScore  = sample.impact * sample.likelihood;
  const residualScore  = sample.residualImpact * sample.residualLikelihood;

  const mitTypeStyle = {
    preventive:  'bg-blue-50 text-blue-700 border border-blue-200',
    detective:   'bg-amber-50 text-amber-700 border border-amber-200',
    corrective:  'bg-emerald-50 text-emerald-700 border border-emerald-200',
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Header — always visible */}
      <button
        className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="font-mono text-xs font-bold text-slate-400">{sample.id}</span>
              <RiskBadge level={scoreLevel(inherentScore)} />
              {sample.internetFacing
                ? <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5"><Globe size={10} />Internet-facing</span>
                : <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5"><Lock size={10} />Internal</span>
              }
              <span className="text-xs text-slate-400">RML: {sample.rml}</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900 leading-snug">{sample.title}</h3>
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
              <span>{sample.system}</span>
              <span className="text-slate-300">·</span>
              <span>Inherent <strong className="text-slate-700">{inherentScore}</strong> ({scoreLevel(inherentScore)})</span>
              <span className="text-slate-300">→</span>
              <span>Residual <strong className="text-slate-700">{residualScore}</strong> ({scoreLevel(residualScore)})</span>
            </div>
          </div>
          <div className="text-slate-400 mt-1 shrink-0">
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">

          {/* Context */}
          <div className="px-5 py-4 bg-slate-50/60">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Context</div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              <div><span className="text-slate-400 text-xs">System</span><div className="font-medium">{sample.system}</div></div>
              <div><span className="text-slate-400 text-xs">RML</span><div className="font-medium">{sample.rml}</div></div>
              <div><span className="text-slate-400 text-xs">Exposure</span><div className="font-medium">{sample.internetFacing ? 'Internet-facing' : 'Internal'}</div></div>
            </div>
          </div>

          {/* Risk Description */}
          <div className="px-5 py-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              Risk Description
              <span className="text-xs font-normal text-slate-400 normal-case">(Cause → Event → Consequence)</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3">
              {sample.riskDescription}
            </p>
          </div>

          {/* Inherent Risk Scoring */}
          <div className="px-5 py-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Inherent Risk Scoring</div>
            <div className="flex items-start gap-8 flex-wrap">
              <RiskMatrix impact={sample.impact} likelihood={sample.likelihood} className="inline-block" />
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-20 text-xs text-slate-400">Impact</span>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(v => (
                      <div key={v} className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${v === sample.impact ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-400'}`}>{v}</div>
                    ))}
                  </div>
                  <span className="text-xs text-slate-500">{sample.impact}/5</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 text-xs text-slate-400">Likelihood</span>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(v => (
                      <div key={v} className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${v === sample.likelihood ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-400'}`}>{v}</div>
                    ))}
                  </div>
                  <span className="text-xs text-slate-500">{sample.likelihood}/5</span>
                </div>
                <div className="pt-1 flex items-center gap-2">
                  <span className="w-20 text-xs text-slate-400">Score</span>
                  <span className="font-mono text-sm font-bold text-slate-800">{sample.impact} × {sample.likelihood} = {inherentScore}</span>
                  <RiskBadge level={scoreLevel(inherentScore)} />
                </div>
              </div>
            </div>
          </div>

          {/* Mitigations */}
          <div className="px-5 py-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Mitigations ({sample.mitigations.length})</div>
            <div className="space-y-2">
              {sample.mitigations.map((m, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className={`shrink-0 mt-0.5 px-2 py-0.5 rounded text-xs font-medium ${mitTypeStyle[m.type] || 'bg-slate-100 text-slate-600'}`}>{m.type}</span>
                  <span className="flex-1 text-slate-700">{m.text}</span>
                  <span className="shrink-0 text-xs text-slate-400 whitespace-nowrap">{m.owner} · {m.due}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Residual Risk */}
          <div className="px-5 py-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Residual Risk (Post-Mitigation)</div>
            <div className="flex items-start gap-8 flex-wrap">
              <RiskMatrix impact={sample.residualImpact} likelihood={sample.residualLikelihood} className="inline-block" />
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-24 text-xs text-slate-400">Residual Impact</span>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(v => (
                      <div key={v} className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${v === sample.residualImpact ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-400'}`}>{v}</div>
                    ))}
                  </div>
                  <span className="text-xs text-slate-500">{sample.residualImpact}/5</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-24 text-xs text-slate-400">Residual Likelihood</span>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(v => (
                      <div key={v} className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${v === sample.residualLikelihood ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-400'}`}>{v}</div>
                    ))}
                  </div>
                  <span className="text-xs text-slate-500">{sample.residualLikelihood}/5</span>
                </div>
                <div className="pt-1 flex items-center gap-2">
                  <span className="w-24 text-xs text-slate-400">Residual Score</span>
                  <span className="font-mono text-sm font-bold text-slate-800">{sample.residualImpact} × {sample.residualLikelihood} = {residualScore}</span>
                  <RiskBadge level={scoreLevel(residualScore)} />
                </div>
              </div>
            </div>
          </div>

          {/* Justification */}
          <div className="px-5 py-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Justification</div>
            <p className="text-sm text-slate-700 leading-relaxed bg-emerald-50 border border-emerald-100 rounded-lg p-3">
              {sample.justification}
            </p>
          </div>

        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SampleRisks() {
  const [allOpen, setAllOpen] = useState(false);
  const [key, setKey] = useState(0);

  function toggleAll() {
    setAllOpen(o => !o);
    setKey(k => k + 1);
  }

  return (
    <>
      <PageHeader
        title="Sample Risk Acceptances"
        subtitle="5 reference examples across different risk types and levels"
        actions={
          <button
            onClick={toggleAll}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        }
      />

      {/* Guide banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6 text-sm">
        <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
        <div className="text-blue-800 space-y-1">
          <div className="font-semibold">How to use these samples</div>
          <div className="text-xs leading-relaxed text-blue-700">
            Each sample mirrors the exact fields in the <strong>New Risk</strong> form. Use them as a quality benchmark — especially the Risk Description structure (Cause → Event → Consequence), the mitigation breakdown by type, and the Justification elements required for Medium+ residual risks.
          </div>
        </div>
      </div>

      {/* Score legend */}
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        <span className="text-xs text-slate-400 font-medium">Risk levels:</span>
        {[['Very Low', '<4', 'bg-emerald-100 text-emerald-800'], ['Low', '4–8', 'bg-emerald-100 text-emerald-800'], ['Medium', '9–14', 'bg-amber-100 text-amber-800'], ['High', '≥15', 'bg-red-100 text-red-800']].map(([label, range, cls]) => (
          <span key={label} className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${cls}`}>{label} ({range})</span>
        ))}
        <span className="text-xs text-slate-300">·</span>
        <span className="text-xs text-slate-400">Score = Impact × Likelihood</span>
      </div>

      <div className="space-y-3">
        {SAMPLES.map(s => (
          <SampleCard key={`${s.id}-${key}`} sample={s} defaultOpen={allOpen} />
        ))}
      </div>

      <div className="mt-8 text-xs text-slate-400 text-center">
        These are illustrative examples only. Actual risk assessments must reflect real system context and approved mitigations.
        Contact <span className="text-blue-500">grc@meetings.gov.sg</span> for guidance.
      </div>
    </>
  );
}
