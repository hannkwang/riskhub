export const RISKS = [
  { id: 'RA-2026-014', title: 'Legacy SFTP gateway lacks MFA', owner: 'Mira Tanaka', team: 'App / Payments', impact: 4, likelihood: 4, level: 'High', score: 16, stage: 'Cyber Review', stageColor: 'amber', updated: '2h ago', system: 'Vendor SFTP Gateway', expiryMonths: 6, expiresAt: null },
  { id: 'RA-2026-013', title: 'Vendor API key rotation gap', owner: 'Devon Reyes', team: 'Infra / Cloud', impact: 3, likelihood: 4, level: 'High', score: 12, stage: 'Owner Draft', stageColor: 'slate', updated: '1d ago', system: 'Payments Gateway', expiryMonths: 6, expiresAt: null },
  { id: 'RA-2026-012', title: 'Unpatched K8s nodes (DEV cluster)', owner: 'Priya Sharma', team: 'Infra / Networks', impact: 3, likelihood: 3, level: 'Medium', score: 9, stage: 'Governance', stageColor: 'blue', updated: '3d ago', system: 'K8s DEV Cluster', expiryMonths: 6, expiresAt: null },
  { id: 'RA-2026-011', title: 'Excessive IAM permissions on data lake', owner: 'Sam Okafor', team: 'App / Identity', impact: 5, likelihood: 3, level: 'High', score: 15, stage: 'Approved', stageColor: 'green', updated: '5d ago', system: 'Data Lake — Customer', expiryMonths: 6, expiresAt: '2026-05-31' },
  { id: 'RA-2026-010', title: 'Backup restore not tested in 12 months', owner: 'Lee Park', team: 'Infra / Storage', impact: 4, likelihood: 2, level: 'Medium', score: 8, stage: 'Cyber Review', stageColor: 'amber', updated: '4h ago', system: 'HR Workday', expiryMonths: 9, expiresAt: null },
  { id: 'RA-2026-009', title: 'Logs retained <30d on prod queue', owner: 'Aki Nakamura', team: 'App / Messaging', impact: 2, likelihood: 3, level: 'Low', score: 6, stage: 'Rejected', stageColor: 'red', updated: '6d ago', system: 'Customer Support Portal', expiryMonths: 3, expiresAt: null },
  { id: 'RA-2026-008', title: 'TLS certificate expiring (3 endpoints)', owner: 'Devon Reyes', team: 'Infra / Cloud', impact: 4, likelihood: 2, level: 'Medium', score: 8, stage: 'Approved', stageColor: 'green', updated: '7d ago', system: 'Identity Provider (SSO)', expiryMonths: 3, expiresAt: '2026-06-30' },
  { id: 'RA-2026-007', title: 'PII in DEV environment exports', owner: 'Mira Tanaka', team: 'App / Payments', impact: 4, likelihood: 3, level: 'High', score: 12, stage: 'Owner Draft', stageColor: 'slate', updated: '2d ago', system: 'Data Lake — Customer', expiryMonths: 6, expiresAt: null },
];

export const SYSTEMS = [
  { name: 'Payments Gateway',        crit: 'Critical', sens: 'Restricted',   inet: true,  owner: 'Jordan Walsh',  team: 'Payments BU',   openRAs: 5 },
  { name: 'Vendor SFTP Gateway',     crit: 'High',     sens: 'Restricted',   inet: true,  owner: 'Jordan Walsh',  team: 'Payments BU',   openRAs: 3 },
  { name: 'Identity Provider (SSO)', crit: 'Critical', sens: 'Restricted',   inet: true,  owner: 'Sara Lin',      team: 'Identity BU',   openRAs: 4 },
  { name: 'HR Workday',              crit: 'High',     sens: 'Confidential', inet: false, owner: 'Marcus Webb',   team: 'People Ops',    openRAs: 1 },
  { name: 'Data Lake — Customer',    crit: 'Critical', sens: 'Restricted',   inet: false, owner: 'Lia Romero',    team: 'Data Platform', openRAs: 6 },
  { name: 'Customer Support Portal', crit: 'Medium',   sens: 'Confidential', inet: true,  owner: 'Tomás Field',   team: 'Support BU',    openRAs: 2 },
  { name: 'Internal Wiki',           crit: 'Low',      sens: 'Internal',     inet: false, owner: 'Anita Cole',    team: 'IT Ops',        openRAs: 0 },
  { name: 'K8s DEV Cluster',         crit: 'Medium',   sens: 'Internal',     inet: false, owner: 'Marcus Webb',   team: 'Cloud Infra',   openRAs: 2 },
  { name: 'Mobile Banking App',      crit: 'Critical', sens: 'Restricted',   inet: true,  owner: 'Sara Lin',      team: 'Retail BU',     openRAs: 2 },
];

export const WORKFLOW_STAGES = [
  { key: 'draft',      label: 'Owner Draft',       role: 'Risk owner',          sla: 14 },
  { key: 'biz',        label: 'Business Owner',    role: 'Business sign-off',   sla: 3  },
  { key: 'cyber',      label: 'Cyber Security',    role: 'Cyber team review',   sla: 5  },
  { key: 'tga',        label: 'TGA',               role: 'Tech Gov. Assurance', sla: 5  },
  { key: 'grc',        label: 'GRC Chair',         role: 'Final approval',      sla: 7  },
];

export const BEST_PRACTICES = [
  { id: 'BP-024', area: 'Authentication',  topic: 'MFA on internet-facing transfer services',      used: 23, accepted: 21 },
  { id: 'BP-019', area: 'Network Exposure',topic: 'Compensating control for delayed MFA',          used: 11, accepted: 10 },
  { id: 'BP-007', area: 'Risk Statements', topic: 'Cause–event–consequence structure',             used: 142, accepted: 138 },
  { id: 'BP-031', area: 'Residual Scoring',topic: 'Mitigation effectiveness ratings',              used: 38, accepted: 29 },
  { id: 'BP-042', area: 'Internet Facing', topic: 'Likelihood floor for internet-exposed assets',  used: 26, accepted: 24 },
  { id: 'BP-013', area: 'Justification',   topic: 'Required elements when accepting Med+ residual',used: 51, accepted: 44 },
];

export const USERS = [
  { name: 'Mira Tanaka',   email: 'mira.t@mom.gov.sg',      role: 'Application Team',   team: 'Payments App',    status: 'active', last: '2h ago',  initials: 'MT' },
  { name: 'Sam Okafor',    email: 'sam.o@mom.gov.sg',       role: 'Application Team',   team: 'Identity App',    status: 'active', last: '1d ago',  initials: 'SO' },
  { name: 'Devon Reyes',   email: 'devon.r@mom.gov.sg',     role: 'Infrastructure Team',team: 'Cloud Infra',     status: 'active', last: '20m ago', initials: 'DR' },
  { name: 'Jordan Walsh',  email: 'jordan.w@mom.gov.sg',    role: 'Business Owner',     team: 'Payments BU',     status: 'active', last: '1d ago',  initials: 'JW' },
  { name: 'Hana Brooks',   email: 'hana.b@mom.gov.sg',      role: 'Cyber Security',     team: 'AppSec',          status: 'active', last: '30m ago', initials: 'HB' },
  { name: 'Ravi Iyer',     email: 'ravi.i@mom.gov.sg',      role: 'Cyber Security',     team: 'SOC',             status: 'active', last: '2h ago',  initials: 'RI' },
  { name: 'Chen Wu',       email: 'chen.w@mom.gov.sg',      role: 'TGA',                team: 'Tech Governance', status: 'active', last: '6h ago',  initials: 'CW' },
  { name: 'Eleanor Voss',  email: 'eleanor.v@mom.gov.sg',   role: 'GRC Chair',          team: 'GRC Council',     status: 'active', last: '4d ago',  initials: 'EV' },
  { name: 'Lee Park',      email: 'lee.p@mom.gov.sg',       role: 'Infrastructure Team',team: 'Storage & Backup',status: 'invited',last: '—',       initials: 'LP' },
];
