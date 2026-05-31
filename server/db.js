const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'riskhub.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    team TEXT,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS systems (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    criticality TEXT,
    sensitivity TEXT,
    internet_facing INTEGER DEFAULT 0,
    owner TEXT,
    team TEXT,
    rml TEXT
  );

  CREATE TABLE IF NOT EXISTS best_practices (
    id TEXT PRIMARY KEY,
    area TEXT,
    topic TEXT,
    content TEXT,
    used_count INTEGER DEFAULT 0,
    accepted_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS risks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    risk_statement TEXT,
    owner TEXT,
    team TEXT,
    system_name TEXT,
    impact INTEGER DEFAULT 1,
    likelihood INTEGER DEFAULT 1,
    inherent_score INTEGER,
    residual_impact INTEGER,
    residual_likelihood INTEGER,
    residual_score INTEGER,
    mitigations TEXT DEFAULT '[]',
    justification TEXT,
    review_period_months INTEGER DEFAULT 6,
    stage TEXT DEFAULT 'Draft',
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT
  );

  CREATE TABLE IF NOT EXISTS workflow_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    risk_id TEXT NOT NULL,
    from_stage TEXT,
    to_stage TEXT NOT NULL,
    actor_id TEXT,
    actor_name TEXT,
    action TEXT,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (risk_id) REFERENCES risks(id)
  );

  CREATE TABLE IF NOT EXISTS sla_settings (
    stage TEXT PRIMARY KEY,
    days  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS portal_settings (
    key         TEXT PRIMARY KEY,
    value       INTEGER NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS concurrent_approvals (
    risk_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    comment TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (risk_id, actor_id)
  );
`);

// Migrations — all idempotent; safe to run on every startup

// 1. AI residual columns on risks
const riskCols = db.prepare('PRAGMA table_info(risks)').all().map(c => c.name);
if (!riskCols.includes('ai_residual_impact')) {
  db.prepare('ALTER TABLE risks ADD COLUMN ai_residual_impact INTEGER').run();
  db.prepare('ALTER TABLE risks ADD COLUMN ai_residual_likelihood INTEGER').run();
}

// 2. rml column on systems
const systemCols = db.prepare('PRAGMA table_info(systems)').all().map(c => c.name);
if (!systemCols.includes('rml')) {
  db.prepare('ALTER TABLE systems ADD COLUMN rml TEXT').run();
  db.prepare("UPDATE systems SET rml = 'High'   WHERE criticality IN ('Critical', 'High') AND rml IS NULL").run();
  db.prepare("UPDATE systems SET rml = 'Medium' WHERE criticality = 'Medium' AND rml IS NULL").run();
  db.prepare("UPDATE systems SET rml = 'Low'    WHERE criticality = 'Low' AND rml IS NULL").run();
}

// 2. Stage renames (old workflow → new workflow)
db.prepare("UPDATE risks SET stage = 'System Owner'     WHERE stage = 'Biz Owner'").run();
db.prepare("UPDATE risks SET stage = 'Concurrent Review' WHERE stage IN ('Cyber Review','Governance')").run();
db.prepare("UPDATE workflow_history SET to_stage   = 'System Owner'      WHERE to_stage   = 'Biz Owner'").run();
db.prepare("UPDATE workflow_history SET from_stage = 'System Owner'      WHERE from_stage = 'Biz Owner'").run();
db.prepare("UPDATE workflow_history SET to_stage   = 'Concurrent Review' WHERE to_stage   IN ('Cyber Review','Governance')").run();
db.prepare("UPDATE workflow_history SET from_stage = 'Concurrent Review' WHERE from_stage IN ('Cyber Review','Governance')").run();

// 3. Insert new users if missing — only for already-seeded DBs (avoids poisoning the seed guard)
if (db.prepare('SELECT COUNT(*) as n FROM users').get().n > 0) {
  db.prepare("INSERT OR IGNORE INTO users (id, name, role, team, active) VALUES (?,?,?,?,1)")
    .run('victor', 'Shan Wong',  'tech_governance', 'Tech Governance Assurance');
  db.prepare("INSERT OR IGNORE INTO users (id, name, role, team, active) VALUES (?,?,?,?,1)")
    .run('petra',  'WeiJian',   'grc_chair',       'GRC Council');
  // Update names and ravi's role if they exist under old values
  db.prepare("UPDATE users SET name = 'Hannkwang'    WHERE id = 'eleanor' AND name != 'Hannkwang'").run();
  db.prepare("UPDATE users SET name = 'WeiJian'      WHERE id = 'petra'   AND name != 'WeiJian'").run();
  db.prepare("UPDATE users SET name = 'Shan Wong'    WHERE id = 'victor'  AND name != 'Shan Wong'").run();
  db.prepare("UPDATE users SET name = 'Jayce Tang',  role = 'tech_governance' WHERE id = 'ravi'  AND name != 'Jayce Tang'").run();
  db.prepare("UPDATE users SET name = 'Yih Wen Tsai' WHERE id = 'hana'   AND name != 'Yih Wen Tsai'").run();
  db.prepare("UPDATE users SET team = 'Tech Governance Assurance' WHERE role = 'tech_governance' AND team != 'Tech Governance Assurance'").run();
}

// 4. Seed sla_settings if empty
if (db.prepare('SELECT COUNT(*) as n FROM sla_settings').get().n === 0) {
  const ins = db.prepare('INSERT OR IGNORE INTO sla_settings (stage, days) VALUES (?,?)');
  ins.run('Draft', 14);
  ins.run('System Owner', 3);
  ins.run('Concurrent Review', 7);
}

// 5. Seed portal_settings if empty
if (db.prepare('SELECT COUNT(*) as n FROM portal_settings').get().n === 0) {
  db.prepare('INSERT OR IGNORE INTO portal_settings (key, value, description) VALUES (?,?,?)')
    .run('review_period_months', 12, 'Default risk acceptance review period in months (expiry = end of same calendar month, N months after approval)');
}

// 6. Singaporean names for engineers and biz_owners
if (db.prepare('SELECT COUNT(*) as n FROM users').get().n > 0) {
  const userRenames = [
    ['mira',   'Huiling Tan'],
    ['sam',    'Farhan Malik'],
    ['devon',  'Arjun Nair'],
    ['lee',    'Wei Jie Lim'],
    ['jordan', 'Priya Ramasamy'],
    ['sara',   'Xinyi Chen'],
  ];
  for (const [id, newName] of userRenames) {
    const row = db.prepare('SELECT name FROM users WHERE id = ?').get(id);
    if (row && row.name !== newName) {
      db.prepare('UPDATE systems SET owner = ? WHERE owner = ?').run(newName, row.name);
      db.prepare('UPDATE risks    SET owner = ? WHERE owner = ?').run(newName, row.name);
      db.prepare('UPDATE users    SET name  = ? WHERE id    = ?').run(newName, id);
    }
  }
  // Non-user system owners referenced only in the systems table
  const sysRenames = [
    ['Marcus Webb', 'Boon Huat Lee'],
    ['Lia Romero',  'Siti Nora'],
    ['Tomás Field', 'Dinesh Pillai'],
    ['Anita Cole',  'Mei Xuan Ng'],
  ];
  for (const [old, neo] of sysRenames) {
    db.prepare('UPDATE systems SET owner = ? WHERE owner = ?').run(neo, old);
  }
}

// 7. Back-fill concurrent_approvals for any risk already in Concurrent Review
{
  const openRisks = db.prepare("SELECT id FROM risks WHERE stage = 'Concurrent Review'").all();
  const reviewers  = db.prepare("SELECT id, role FROM users WHERE role IN ('security','tech_governance','grc_chair') AND active = 1").all();
  const upsertCA   = db.prepare("INSERT OR IGNORE INTO concurrent_approvals (risk_id, actor_id, role) VALUES (?,?,?)");
  for (const r of openRisks) {
    for (const u of reviewers) upsertCA.run(r.id, u.id, u.role);
  }
}

// ---------------------------------------------------------------------------

function daysAgo(d) {
  return new Date(Date.now() - d * 86400000).toISOString().replace('T', ' ').substring(0, 19);
}
function isoFuture(days) {
  return new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
}

function seedIfEmpty() {
  const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  if (userCount > 0) return;

  // Users
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, name, role, team) VALUES (?,?,?,?)');
  [
    ['mira',    'Huiling Tan',    'engineer',       'App / Payments'],
    ['sam',     'Farhan Malik',  'engineer',       'App / Identity'],
    ['devon',   'Arjun Nair',    'engineer',       'Infra / Cloud'],
    ['lee',     'Wei Jie Lim',   'engineer',       'Infra / Storage'],
    ['jordan',  'Priya Ramasamy','biz_owner',      'Payments BU'],
    ['sara',    'Xinyi Chen',    'biz_owner',      'Identity BU'],
    ['hana',    'Yih Wen Tsai',  'security',       'Cyber Security'],
    ['ravi',    'Jayce Tang',    'tech_governance','Tech Governance Assurance'],
    ['victor',  'Shan Wong',     'tech_governance','Tech Governance Assurance'],
    ['eleanor', 'Hannkwang',     'grc_chair',      'GRC Council'],
    ['petra',   'WeiJian',       'grc_chair',      'GRC Council'],
  ].forEach(u => insertUser.run(...u));

  // Systems
  const insertSystem = db.prepare(
    'INSERT OR IGNORE INTO systems (id, name, criticality, sensitivity, internet_facing, owner, team, rml) VALUES (?,?,?,?,?,?,?,?)'
  );
  [
    ['sys-1', 'Payments Gateway',        'Critical', 'Restricted',   1, 'Priya Ramasamy', 'Payments BU',   'High'],
    ['sys-2', 'Vendor SFTP Gateway',     'High',     'Restricted',   1, 'Priya Ramasamy', 'Payments BU',   'High'],
    ['sys-3', 'Identity Provider (SSO)', 'Critical', 'Restricted',   1, 'Xinyi Chen',     'Identity BU',   'High'],
    ['sys-4', 'HR Workday',              'High',     'Confidential', 0, 'Boon Huat Lee',  'People Ops',    'Medium'],
    ['sys-5', 'Data Lake — Customer',    'Critical', 'Restricted',   0, 'Siti Nora',      'Data Platform', 'High'],
    ['sys-6', 'Customer Support Portal', 'Medium',   'Confidential', 1, 'Dinesh Pillai',  'Support BU',    'Medium'],
    ['sys-7', 'Internal Wiki',           'Low',      'Internal',     0, 'Mei Xuan Ng',    'IT Ops',        'Low'],
    ['sys-8', 'K8s DEV Cluster',         'Medium',   'Internal',     0, 'Boon Huat Lee',  'Cloud Infra',   'Medium'],
    ['sys-9', 'Mobile Banking App',      'Critical', 'Restricted',   1, 'Xinyi Chen',     'Retail BU',     'High'],
  ].forEach(s => insertSystem.run(...s));

  // Risks and history
  const insertRisk = db.prepare(`
    INSERT OR IGNORE INTO risks
      (id, title, risk_statement, owner, team, system_name, impact, likelihood,
       inherent_score, residual_impact, residual_likelihood, residual_score,
       mitigations, justification, review_period_months, stage, created_by, created_at, updated_at, expires_at)
    VALUES (@id,@title,@statement,@owner,@team,@system,@impact,@likelihood,
       @inherentScore,@ri,@rl,@residualScore,@mitigations,@justification,
       @reviewMonths,@stage,@createdBy,@createdAt,@updatedAt,@expiresAt)
  `);
  const insertHistory = db.prepare(`
    INSERT OR IGNORE INTO workflow_history
      (risk_id, from_stage, to_stage, actor_id, actor_name, action, comment, created_at)
    VALUES (?,?,?,?,?,?,?,?)
  `);

  const seedRisks = [
    // --- Concurrent Review (all concurrent approvers working in parallel) ---
    {
      id: 'RA-2026-001',
      title: 'Mobile Banking App — Missing account lockout on PIN authentication',
      statement: 'Because the Mobile Banking App does not enforce account lockout or exponential back-off after repeated failed PIN attempts, an attacker with possession of a stolen device could conduct an automated brute-force attack against the 6-digit PIN within minutes, resulting in full account takeover and fraudulent fund transfers affecting up to 2.3 million retail banking customers.',
      owner: 'Huiling Tan', createdBy: 'mira', team: 'App / Payments', system: 'Mobile Banking App',
      impact: 5, likelihood: 4, ri: 3, rl: 2,
      stage: 'Concurrent Review',
      mitigations: JSON.stringify([
        { text: 'Implement 5-attempt lockout with 15-min progressive delay', owner: 'Huiling', due: 'Jun 30', type: 'preventive' },
        { text: 'Push notification alert on PIN failure >3 attempts', owner: 'Jayce', due: 'Jun 30', type: 'detective' },
        { text: 'Biometric fallback mandatory for high-value transactions', owner: 'Xinyi', due: 'Jul 31', type: 'preventive' },
      ]),
      justification: 'Account lockout and biometric requirements reduce brute-force likelihood to near-zero. Residual risk is Low — accepted by Retail BU pending Jul 31 biometric rollout. Named owner: Xinyi Chen. Monitoring KPI: >3 PIN failures in 10 min triggers SOC alert. Reassessment at biometric rollout completion.',
      reviewMonths: 6,
      createdAt: daysAgo(18), updatedAt: daysAgo(3), expiresAt: null,
      history: [
        { from: null,             to: 'Draft',             actor: 'mira',   name: 'Huiling Tan',    action: 'create',  comment: 'Draft created', at: daysAgo(18) },
        { from: 'Draft',          to: 'System Owner',       actor: 'mira',   name: 'Huiling Tan',    action: 'submit',  comment: 'Lockout gap confirmed by AppSec pen-test finding PT-2026-089.', at: daysAgo(12) },
        { from: 'System Owner',   to: 'Concurrent Review',  actor: 'sara',   name: 'Xinyi Chen',     action: 'approve', comment: 'High priority — fast-tracked to concurrent review. Biometric deadline accepted.', at: daysAgo(3) },
      ],
    },
    {
      id: 'RA-2026-004',
      title: 'Data Lake — Unmasked PII accessible to non-data roles via misconfigured Athena views',
      statement: 'Because AWS Athena views on the Customer Data Lake lack column-level security controls and were granted to a broad data-read IAM role shared across engineering teams, non-data-platform engineers can query unmasked PII — including NRIC, home address, and declared income — for all 1.2 million customers, resulting in a potential PDPA breach with mandatory regulatory notification obligations within 3 days of discovery.',
      owner: 'Farhan Malik', createdBy: 'sam', team: 'App / Identity', system: 'Data Lake — Customer',
      impact: 5, likelihood: 3, ri: 3, rl: 2,
      stage: 'Concurrent Review',
      mitigations: JSON.stringify([
        { text: 'Apply column-level masking on NRIC, address, income fields in all Athena views', owner: 'Farhan', due: 'Jun 20', type: 'preventive' },
        { text: 'Audit and revoke data-read IAM role from non-data-platform principals', owner: 'Arjun', due: 'Jun 15', type: 'preventive' },
        { text: 'Enable CloudTrail data-event logging on S3 buckets backing the Data Lake', owner: 'Jayce', due: 'Jun 15', type: 'detective' },
        { text: 'Monthly IAM access review for Data Lake roles', owner: 'Farhan', due: 'Ongoing', type: 'detective' },
      ]),
      justification: 'Column-level masking eliminates direct PII access. IAM remediation reduces scope to data-platform team only. Residual risk is Medium — accepted by Siti Nora (Data Platform lead) pending masking deployment. Monitoring KPIs: CloudTrail alerts on mass-select queries (>10k rows/min) and IAM policy change events. Quarterly IAM review cadence.',
      reviewMonths: 6,
      createdAt: daysAgo(10), updatedAt: daysAgo(1), expiresAt: null,
      history: [
        { from: null,            to: 'Draft',             actor: 'sam',    name: 'Farhan Malik',  action: 'create',  comment: 'Draft created', at: daysAgo(10) },
        { from: 'Draft',         to: 'System Owner',       actor: 'sam',    name: 'Farhan Malik',  action: 'submit',  comment: 'IAM misconfiguration identified during Q2 access review. Masking remediation scoped.', at: daysAgo(6) },
        { from: 'System Owner',  to: 'Concurrent Review',  actor: 'sara',   name: 'Xinyi Chen',    action: 'approve', comment: 'Data Platform owner Siti Nora briefed. Approved to proceed to concurrent review.', at: daysAgo(1) },
      ],
    },

    // --- System Owner stage ---
    {
      id: 'RA-2026-003',
      title: 'Identity Provider (SSO) — SAML assertions not fully validated against XML signature wrapping',
      statement: 'Because the legacy SAML assertion parser in the Identity Provider (SSO) does not implement defence against XML Signature Wrapping (XSW) attacks, an authenticated user could craft a malicious SAML response that passes signature validation while substituting an arbitrary subject, resulting in full account takeover of any employee — including privileged system administrators — without requiring the target user\'s credentials.',
      owner: 'Arjun Nair', createdBy: 'devon', team: 'Infra / Cloud', system: 'Identity Provider (SSO)',
      impact: 5, likelihood: 3, ri: 2, rl: 2,
      stage: 'System Owner',
      mitigations: JSON.stringify([
        { text: 'Upgrade SAML library to python3-saml ≥3.0.0 with XSW protection', owner: 'Arjun', due: 'Jul 15', type: 'preventive' },
        { text: 'Add integration test suite for XSW attack vectors (OWASP list)', owner: 'Arjun', due: 'Jul 20', type: 'preventive' },
        { text: 'Enable anomaly alerting on SAML login events from unusual source IPs', owner: 'Jayce', due: 'Jun 30', type: 'detective' },
      ]),
      justification: 'Library upgrade eliminates the XSW vulnerability class. Residual risk is Low after upgrade. Exploit requires existing authenticated session — opportunistic exploitation is difficult. Named owner: Xinyi Chen (IdP). Monitoring KPI: SIEM alert on SSO logins outside business hours from new IPs. Reassessment post-upgrade in Aug 2026.',
      reviewMonths: 6,
      createdAt: daysAgo(5), updatedAt: daysAgo(1), expiresAt: null,
      history: [
        { from: null,    to: 'Draft',        actor: 'devon', name: 'Arjun Nair', action: 'create', comment: 'Draft created', at: daysAgo(5) },
        { from: 'Draft', to: 'System Owner', actor: 'devon', name: 'Arjun Nair', action: 'submit', comment: 'Finding from external pen-test (Coalfire, May 2026). CVSS 8.8. Library upgrade scheduled for Jul.', at: daysAgo(1) },
      ],
    },

    // --- Approved ---
    {
      id: 'RA-2026-002',
      title: 'Payments Gateway — Primary account numbers written to application debug logs',
      statement: 'Because the Payments Gateway\'s verbose debug logging mode was inadvertently enabled in production during a hotfix deployment, full 16-digit PANs are written in plaintext to the centralised log aggregation platform (Splunk), which is accessible to all Tier-2 operations staff, resulting in PCI-DSS non-compliance and potential regulatory penalties exceeding SGD 1 million if discovered during the upcoming audit.',
      owner: 'Huiling Tan', createdBy: 'mira', team: 'App / Payments', system: 'Payments Gateway',
      impact: 5, likelihood: 3, ri: 2, rl: 1,
      stage: 'Approved',
      mitigations: JSON.stringify([
        { text: 'Disable debug logging in production Payments Gateway (immediate)', owner: 'Huiling', due: 'May 20', type: 'preventive' },
        { text: 'Implement PAN tokenisation before any log write in payment flow', owner: 'Huiling', due: 'Jun 30', type: 'preventive' },
        { text: 'Restrict Splunk access to PCI-scoped indexes for Tier-2 ops', owner: 'Jayce', due: 'Jun 15', type: 'preventive' },
        { text: 'DLP rule in Splunk to detect and alert on PAN-formatted strings in logs', owner: 'Jayce', due: 'Jun 15', type: 'detective' },
      ]),
      justification: 'Debug logging disabled immediately on detection — no new PANs entering logs. Tokenisation eliminates the root cause permanently. DLP alerting provides ongoing detective control. Residual risk is Very Low post-remediation. Business owner: Priya Ramasamy (Payments BU). Monitoring KPI: DLP alert triggers must be zero within 14 days of tokenisation go-live.',
      reviewMonths: 3,
      createdAt: daysAgo(30), updatedAt: daysAgo(8), expiresAt: isoFuture(82),
      history: [
        { from: null,              to: 'Draft',             actor: 'mira',    name: 'Huiling Tan',    action: 'create',  comment: 'Draft created', at: daysAgo(30) },
        { from: 'Draft',           to: 'System Owner',      actor: 'mira',    name: 'Huiling Tan',    action: 'submit',  comment: 'P1 incident — debug flag found during PCI audit prep. Immediate disable underway.', at: daysAgo(25) },
        { from: 'System Owner',    to: 'Concurrent Review', actor: 'jordan',  name: 'Priya Ramasamy', action: 'approve', comment: 'Fast-tracked. Payments BU accepts risk pending tokenisation.', at: daysAgo(23) },
        { from: 'Concurrent Review', to: 'Concurrent Review', actor: 'hana', name: 'Yih Wen Tsai',   action: 'approve', comment: 'Debug flag disabled confirmed. Tokenisation timeline acceptable.', at: daysAgo(20) },
        { from: 'Concurrent Review', to: 'Concurrent Review', actor: 'victor',name: 'Shan Wong',  action: 'approve', comment: 'PCI remediation plan reviewed. Approved.', at: daysAgo(18) },
        { from: 'Concurrent Review', to: 'Concurrent Review', actor: 'eleanor',name: 'Hannkwang',action: 'approve', comment: 'Approved. Tokenisation deadline must be met.', at: daysAgo(15) },
        { from: 'Concurrent Review', to: 'Concurrent Review', actor: 'petra', name: 'WeiJian', action: 'approve', comment: 'Approved. DLP monitoring is a strong detective control.', at: daysAgo(12) },
        { from: 'Concurrent Review', to: 'Approved',         actor: 'system', name: 'System',       action: 'auto_approve', comment: 'All reviewers approved', at: daysAgo(12) },
      ],
    },
    {
      id: 'RA-2026-005',
      title: 'HR Workday — Contractor accounts not deprovisioned within 24-hour policy SLA',
      statement: 'Because the contractor offboarding process relies on manual Jira ticket escalation rather than automated Active Directory deprovisioning, terminated contractors retain fully active Workday accounts for an average of 14 days post-departure — in violation of the 24-hour deprovisioning policy — enabling continued access to payroll records, personal data, and salary bands for all 3,400 Ministry employees.',
      owner: 'Wei Jie Lim', createdBy: 'lee', team: 'Infra / Storage', system: 'HR Workday',
      impact: 3, likelihood: 4, ri: 2, rl: 2,
      stage: 'Approved',
      mitigations: JSON.stringify([
        { text: 'Automate AD deprovisioning via HRMS webhook on termination event', owner: 'Wei Jie', due: 'Jul 31', type: 'preventive' },
        { text: 'Daily audit job: flag any contractor accounts active >48h post-termination', owner: 'Arjun', due: 'Jun 20', type: 'detective' },
        { text: 'Weekly deprovisioning compliance report to HRBP and IT Ops', owner: 'Wei Jie', due: 'Ongoing', type: 'detective' },
      ]),
      justification: 'Automation eliminates the manual gap. Daily audit provides compensating detective control until automation is live. Residual risk is Low — accepted by Boon Huat Lee (People Ops). Monitoring KPI: zero active contractor accounts >48h post-termination date (tracked via daily audit job). Reassessment after automation go-live, Q3 2026.',
      reviewMonths: 9,
      createdAt: daysAgo(45), updatedAt: daysAgo(14), expiresAt: isoFuture(256),
      history: [
        { from: null,              to: 'Draft',             actor: 'lee',     name: 'Wei Jie Lim',    action: 'create',  comment: 'Draft created', at: daysAgo(45) },
        { from: 'Draft',           to: 'System Owner',      actor: 'lee',     name: 'Wei Jie Lim',    action: 'submit',  comment: 'Identified during internal audit review cycle Q1 2026.', at: daysAgo(38) },
        { from: 'System Owner',    to: 'Concurrent Review', actor: 'jordan',  name: 'Priya Ramasamy', action: 'approve', comment: 'People Ops briefed. Boon Huat Lee accepts. Automation scoped.', at: daysAgo(35) },
        { from: 'Concurrent Review', to: 'Concurrent Review', actor: 'hana', name: 'Yih Wen Tsai',   action: 'approve', comment: 'Daily audit job is an adequate interim control.', at: daysAgo(30) },
        { from: 'Concurrent Review', to: 'Concurrent Review', actor: 'victor',name: 'Shan Wong',  action: 'approve', comment: 'Automation timeline is reasonable. Approved.', at: daysAgo(28) },
        { from: 'Concurrent Review', to: 'Concurrent Review', actor: 'eleanor',name: 'Hannkwang',action: 'approve', comment: 'Approved. Compliance report must go to HRBP.', at: daysAgo(22) },
        { from: 'Concurrent Review', to: 'Concurrent Review', actor: 'petra', name: 'WeiJian', action: 'approve', comment: 'Acceptable. Monitoring cadence is sufficient.', at: daysAgo(20) },
        { from: 'Concurrent Review', to: 'Approved',         actor: 'system', name: 'System',       action: 'auto_approve', comment: 'All reviewers approved', at: daysAgo(20) },
      ],
    },

    // --- Draft ---
    {
      id: 'RA-2026-006',
      title: 'K8s DEV Cluster — Application secrets stored as base64 env vars in pod specs',
      statement: 'Because the DEV Kubernetes cluster stores database credentials and third-party API keys as base64-encoded environment variables directly in pod specifications rather than using Kubernetes Secrets or a secrets management solution (HashiCorp Vault), any engineer with pod-read permission can trivially decode production-equivalent credentials, resulting in potential cross-environment privilege escalation and unauthorised access to production data stores.',
      owner: 'Arjun Nair', createdBy: 'devon', team: 'Infra / Cloud', system: 'K8s DEV Cluster',
      impact: 3, likelihood: 3, ri: 2, rl: 1,
      stage: 'Draft',
      mitigations: JSON.stringify([
        { text: 'Migrate all secrets to Kubernetes Secrets with RBAC read restrictions', owner: 'Arjun', due: 'Jun 30', type: 'preventive' },
        { text: 'Integrate HashiCorp Vault for dynamic credential injection', owner: 'Arjun', due: 'Aug 31', type: 'preventive' },
        { text: 'OPA/Gatekeeper policy to block pod specs with base64-pattern env vars at admission', owner: 'Arjun', due: 'Jul 15', type: 'preventive' },
      ]),
      justification: 'Kubernetes Secrets with RBAC and Vault integration eliminate the root cause. OPA admission control prevents recurrence. Residual risk is Very Low post-migration. Cloud Infra accepts residual during migration period.',
      reviewMonths: 6,
      createdAt: daysAgo(2), updatedAt: daysAgo(0.5), expiresAt: null,
      history: [
        { from: null, to: 'Draft', actor: 'devon', name: 'Arjun Nair', action: 'create', comment: 'Draft created — found during K8s security review.', at: daysAgo(2) },
      ],
    },

    // --- Rejected ---
    {
      id: 'RA-2026-007',
      title: 'Customer Support Portal — Password reset flow reveals valid registered email addresses',
      statement: 'Because the Customer Support Portal password reset endpoint returns distinct HTTP 200 OK (with email sent confirmation) vs HTTP 404 (unknown email) responses, an automated attacker can enumerate all registered customer email addresses through high-volume probing, resulting in a targeted phishing list of up to 50,000 active support users that could be used for credential-stuffing or social engineering campaigns.',
      owner: 'Wei Jie Lim', createdBy: 'lee', team: 'Infra / Storage', system: 'Customer Support Portal',
      impact: 2, likelihood: 4, ri: 2, rl: 2,
      stage: 'Rejected',
      mitigations: JSON.stringify([
        { text: 'Return identical response for valid and invalid email addresses', owner: 'Wei Jie', due: 'Jul 1', type: 'preventive' },
      ]),
      justification: 'Single mitigation adequately addresses the issue.',
      reviewMonths: 6,
      createdAt: daysAgo(20), updatedAt: daysAgo(7), expiresAt: null,
      history: [
        { from: null,           to: 'Draft',        actor: 'lee',    name: 'Wei Jie Lim',    action: 'create',          comment: 'Draft created', at: daysAgo(20) },
        { from: 'Draft',        to: 'System Owner', actor: 'lee',    name: 'Wei Jie Lim',    action: 'submit',          comment: 'Identified during OWASP top 10 review.', at: daysAgo(14) },
        { from: 'System Owner', to: 'Rejected',     actor: 'jordan', name: 'Priya Ramasamy', action: 'reject',          comment: 'Justification is insufficient for a Medium inherent risk. Please include: (1) named accountable owner, (2) at least two monitoring KPIs, (3) business rationale for accepting rather than fixing immediately. Re-submit after updating per BP-013.', at: daysAgo(7) },
      ],
    },
  ];

  const seedAll = db.transaction(() => {
    for (const r of seedRisks) {
      insertRisk.run({
        id: r.id, title: r.title, statement: r.statement,
        owner: r.owner, team: r.team, system: r.system,
        impact: r.impact, likelihood: r.likelihood,
        inherentScore: r.impact * r.likelihood,
        ri: r.ri, rl: r.rl, residualScore: r.ri * r.rl,
        mitigations: r.mitigations, justification: r.justification,
        reviewMonths: r.reviewMonths, stage: r.stage, createdBy: r.createdBy,
        createdAt: r.createdAt, updatedAt: r.updatedAt, expiresAt: r.expiresAt,
      });
      for (const h of r.history) {
        insertHistory.run(r.id, h.from, h.to, h.actor, h.name, h.action, h.comment, h.at);
      }
    }

    // Seed concurrent_approvals for risks in Concurrent Review
    const concurrentRisks = db.prepare("SELECT id FROM risks WHERE stage = 'Concurrent Review'").all();
    const reviewers = db.prepare("SELECT id, role FROM users WHERE role IN ('security','tech_governance','grc_chair') AND active = 1").all();
    const caInsert = db.prepare("INSERT OR IGNORE INTO concurrent_approvals (risk_id, actor_id, role, status) VALUES (?,?,?,?)");
    for (const r of concurrentRisks) {
      for (const u of reviewers) {
        // RA-2026-001: hana approved, others pending
        let status = 'pending';
        if (r.id === 'RA-2026-001' && u.id === 'hana') status = 'approved';
        // RA-2026-004: eleanor routed back, others pending
        if (r.id === 'RA-2026-004' && u.id === 'eleanor') status = 'routed_back';
        caInsert.run(r.id, u.id, u.role, status);
      }
    }

    // Set comments for routed-back entries
    db.prepare("UPDATE concurrent_approvals SET comment = ? WHERE risk_id = ? AND actor_id = ?")
      .run('Please confirm which data classification tier the customer PII falls under (Restricted vs Confidential) and provide the DPO sign-off reference number before I can approve.', 'RA-2026-004', 'eleanor');
    db.prepare("UPDATE concurrent_approvals SET comment = ? WHERE risk_id = ? AND actor_id = ?")
      .run('IAM audit remediation confirmed in pen-test scope. Approved.', 'RA-2026-001', 'hana');

  });
  seedAll();
}

seedIfEmpty();

module.exports = db;
