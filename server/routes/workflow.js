const express = require('express');
const db = require('../db');
const { requireActor, getActor } = require('../lib/auth');

const router = express.Router();

const CONCURRENT_ROLES = new Set(['security', 'tech_governance', 'grc_chair']);

// Roles where ANY ONE member approving satisfies the team requirement
const TEAM_BASED_ROLES = new Set(['security', 'tech_governance']);

// Returns true when all three groups have their approval requirement met:
//   security:        at least 1 approved
//   tech_governance: at least 1 approved
//   grc_chair:       ALL co-chairs must individually approve
function allTeamsApproved(riskId) {
  const secOk = db.prepare(
    "SELECT COUNT(*) as n FROM concurrent_approvals WHERE risk_id = ? AND role = 'security' AND status = 'approved'"
  ).get(riskId).n > 0;
  const tgaOk = db.prepare(
    "SELECT COUNT(*) as n FROM concurrent_approvals WHERE risk_id = ? AND role = 'tech_governance' AND status = 'approved'"
  ).get(riskId).n > 0;
  const grcPending = db.prepare(
    "SELECT COUNT(*) as n FROM concurrent_approvals WHERE risk_id = ? AND role = 'grc_chair' AND status != 'approved'"
  ).get(riskId).n;
  return secOk && tgaOk && grcPending === 0;
}

// Stage transition rules for non-concurrent stages
const TRANSITIONS = {
  'Draft': {
    submit: { to: 'System Owner', requiredRole: 'engineer' },
  },
  'System Owner': {
    approve:         { to: 'Concurrent Review', requiredRole: 'biz_owner' },
    reject:          { to: 'Draft',             requiredRole: 'biz_owner' },
    request_changes: { to: 'Draft',             requiredRole: 'biz_owner' },
  },
};

// Stage each role is responsible for (used by queue endpoint)
const ROLE_STAGE = {
  engineer:       'Draft',
  biz_owner:      'System Owner',
  security:       'Concurrent Review',
  tech_governance:'Concurrent Review',
  grc_chair:      'Concurrent Review',
};

function parseUtc(s) { const t = s.includes('T') ? s : s.replace(' ', 'T'); return new Date(t.endsWith('Z') ? t : t + 'Z'); }
function timeAgo(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - parseUtc(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function computeExpiry() {
  const setting = db.prepare("SELECT value FROM portal_settings WHERE key = 'review_period_months'").get();
  const months = setting ? parseInt(setting.value) : 12;
  // End of the same calendar month, N months after approval date
  const exp = new Date();
  exp.setDate(1);
  exp.setMonth(exp.getMonth() + months + 1, 0);
  return exp.toISOString().split('T')[0];
}

// GET /api/workflow/:id/history
router.get('/:id/history', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM workflow_history WHERE risk_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);
  res.json(rows.map(h => ({ ...h, time_ago: timeAgo(h.created_at) })));
});

// GET /api/workflow/:id/concurrent-status
router.get('/:id/concurrent-status', (req, res) => {
  const rows = db.prepare(`
    SELECT ca.*, u.name as actor_name
    FROM concurrent_approvals ca
    JOIN users u ON u.id = ca.actor_id
    WHERE ca.risk_id = ?
    ORDER BY ca.role, u.name
  `).all(req.params.id);
  res.json(rows);
});

// POST /api/workflow/:id/transition  — Draft and System Owner stages
router.post('/:id/transition', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor) return;

  const { action, comment } = req.body;
  if (!action) return res.status(400).json({ error: 'action is required' });

  const risk = db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id);
  if (!risk) return res.status(404).json({ error: 'Risk not found' });

  const stageRules = TRANSITIONS[risk.stage];
  if (!stageRules) {
    return res.status(400).json({ error: `No transitions defined for stage: ${risk.stage}` });
  }

  const rule = stageRules[action];
  if (!rule) {
    return res.status(400).json({ error: `Action "${action}" not allowed in stage "${risk.stage}"` });
  }

  // Draft submit: allow the risk creator regardless of role, or any engineer
  if (risk.stage === 'Draft' && action === 'submit') {
    if (actor.id !== risk.created_by && actor.role !== 'engineer') {
      return res.status(403).json({ error: 'Only the risk creator or an engineer can submit a draft' });
    }
  } else if (actor.role !== rule.requiredRole) {
    return res.status(403).json({
      error: `Action "${action}" in stage "${risk.stage}" requires role "${rule.requiredRole}" but actor has role "${actor.role}"`,
    });
  }

  // System Owner stage: only the biz_owner responsible for this system may act
  if (risk.stage === 'System Owner' && actor.role === 'biz_owner') {
    const sys = db.prepare('SELECT owner FROM systems WHERE name = ?').get(risk.system_name);
    if (sys && sys.owner && sys.owner !== actor.name) {
      return res.status(403).json({ error: `Only the system owner (${sys.owner}) can act on this risk` });
    }
  }

  const fromStage = risk.stage;
  const toStage = rule.to;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  let expiresAt = risk.expires_at;
  if (toStage === 'Approved') expiresAt = computeExpiry();

  db.transaction(() => {
    db.prepare('UPDATE risks SET stage = ?, updated_at = ?, expires_at = ? WHERE id = ?')
      .run(toStage, now, expiresAt, risk.id);

    db.prepare(`
      INSERT INTO workflow_history (risk_id, from_stage, to_stage, actor_id, actor_name, action, comment, created_at)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(risk.id, fromStage, toStage, actor.id, actor.name, action, comment || null, now);

    // When System Owner approves → seed concurrent_approvals for all required reviewers
    if (toStage === 'Concurrent Review') {
      const reviewers = db.prepare(
        "SELECT id, role FROM users WHERE role IN ('security','tech_governance','grc_chair') AND active = 1"
      ).all();
      const upsertCA = db.prepare(
        "INSERT OR IGNORE INTO concurrent_approvals (risk_id, actor_id, role, status) VALUES (?,?,?,'pending')"
      );
      for (const u of reviewers) upsertCA.run(risk.id, u.id, u.role);
    }
  })();

  res.json({ risk_id: risk.id, from_stage: fromStage, to_stage: toStage, action, actor: actor.name });
});

// POST /api/workflow/:id/concurrent  — approve or route_back in Concurrent Review
router.post('/:id/concurrent', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor) return;

  if (!CONCURRENT_ROLES.has(actor.role)) {
    return res.status(403).json({ error: 'Only concurrent review roles can use this endpoint' });
  }

  const { action, comment } = req.body;
  if (!['approve', 'route_back'].includes(action)) {
    return res.status(400).json({ error: 'action must be approve or route_back' });
  }
  if (action === 'route_back' && !comment?.trim()) {
    return res.status(400).json({ error: 'A comment is required when routing back' });
  }

  const risk = db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id);
  if (!risk) return res.status(404).json({ error: 'Risk not found' });
  if (risk.stage !== 'Concurrent Review') {
    return res.status(400).json({ error: 'Risk is not in Concurrent Review stage' });
  }

  const myRow = db.prepare('SELECT * FROM concurrent_approvals WHERE risk_id = ? AND actor_id = ?')
    .get(risk.id, actor.id);
  if (!myRow) {
    return res.status(403).json({ error: 'You are not a required reviewer for this risk' });
  }

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const newStatus = action === 'approve' ? 'approved' : 'routed_back';

  db.transaction(() => {
    db.prepare(
      'UPDATE concurrent_approvals SET status = ?, comment = ?, updated_at = ? WHERE risk_id = ? AND actor_id = ?'
    ).run(newStatus, comment || null, now, risk.id, actor.id);

    db.prepare(`
      INSERT INTO workflow_history (risk_id, from_stage, to_stage, actor_id, actor_name, action, comment, created_at)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(risk.id, 'Concurrent Review', 'Concurrent Review', actor.id, actor.name, action, comment || null, now);

    // Auto-approve when all team requirements are met
    if (action === 'approve') {
      if (allTeamsApproved(risk.id)) {
        const expiresAt = computeExpiry();
        db.prepare('UPDATE risks SET stage = ?, updated_at = ?, expires_at = ? WHERE id = ?')
          .run('Approved', now, expiresAt, risk.id);
        db.prepare(`
          INSERT INTO workflow_history (risk_id, from_stage, to_stage, actor_id, actor_name, action, comment, created_at)
          VALUES (?,?,?,?,?,?,?,?)
        `).run(risk.id, 'Concurrent Review', 'Approved', 'system', 'System', 'auto_approve', 'All reviewers approved', now);
      }
    }
  })();

  res.json({ risk_id: risk.id, action, actor: actor.name, status: newStatus });
});

// POST /api/workflow/:id/raiser-respond  — engineer responds to route-backs
router.post('/:id/raiser-respond', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor) return;

  const { comment } = req.body;
  if (!comment?.trim()) return res.status(400).json({ error: 'comment is required' });

  const risk = db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id);
  if (!risk) return res.status(404).json({ error: 'Risk not found' });

  if (actor.id !== risk.created_by && actor.role !== 'engineer') {
    return res.status(403).json({ error: 'Only the risk creator or an engineer can respond to route-backs' });
  }

  if (risk.stage !== 'Concurrent Review') {
    return res.status(400).json({ error: 'Risk is not in Concurrent Review stage' });
  }

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  db.transaction(() => {
    // Reset all routed_back → pending so those reviewers see the updated info
    db.prepare(
      "UPDATE concurrent_approvals SET status = 'pending', comment = NULL, updated_at = ? WHERE risk_id = ? AND status = 'routed_back'"
    ).run(now, risk.id);

    db.prepare(`
      INSERT INTO workflow_history (risk_id, from_stage, to_stage, actor_id, actor_name, action, comment, created_at)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(risk.id, 'Concurrent Review', 'Concurrent Review', actor.id, actor.name, 'raiser_respond', comment, now);
  })();

  res.json({ risk_id: risk.id, action: 'raiser_respond', actor: actor.name });
});

// GET /api/workflow/queue/:role
router.get('/queue/:role', (req, res) => {
  const { role } = req.params;
  const stage = ROLE_STAGE[role];
  if (!stage) return res.status(400).json({ error: `Unknown role: ${role}` });

  const SLA_DAYS = { 'Draft': 14, 'System Owner': 3, 'Concurrent Review': 5 };
  const slaDays = SLA_DAYS[stage] || 5;

  let rows;
  if (CONCURRENT_ROLES.has(role)) {
    const actor = getActor(req);
    if (!actor) return res.status(401).json({ error: 'Missing or unknown X-Riskhub-User header' });

    // For team-based roles (security, TGA): hide risks once any teammate has approved.
    // For grc_chair: only hide once THIS specific person has approved.
    const teamFilter = TEAM_BASED_ROLES.has(role)
      ? `AND NOT EXISTS (
           SELECT 1 FROM concurrent_approvals ca2
           WHERE ca2.risk_id = r.id AND ca2.role = '${role}' AND ca2.status = 'approved'
         )`
      : '';

    rows = db.prepare(`
      SELECT r.*, (
        SELECT MAX(wh.created_at) FROM workflow_history wh
        WHERE wh.risk_id = r.id AND wh.to_stage = r.stage
      ) as stage_entered_at
      FROM risks r
      JOIN concurrent_approvals ca ON ca.risk_id = r.id AND ca.actor_id = ? AND ca.status = 'pending'
      WHERE r.stage = 'Concurrent Review'
      ${teamFilter}
      ORDER BY stage_entered_at ASC
    `).all(actor.id);
  } else if (role === 'biz_owner') {
    // System Owners only see risks for systems they specifically own
    const actor = getActor(req);
    if (!actor) return res.status(401).json({ error: 'Missing or unknown X-Riskhub-User header' });

    rows = db.prepare(`
      SELECT r.*, (
        SELECT MAX(wh.created_at) FROM workflow_history wh
        WHERE wh.risk_id = r.id AND wh.to_stage = r.stage
      ) as stage_entered_at
      FROM risks r
      JOIN systems s ON s.name = r.system_name AND s.owner = ?
      WHERE r.stage = 'System Owner'
      ORDER BY stage_entered_at ASC
    `).all(actor.name);
  } else {
    const actor = getActor(req);
    if (!actor) return res.status(401).json({ error: 'Missing or unknown X-Riskhub-User header' });
    rows = db.prepare(`
      SELECT r.*, (
        SELECT MAX(wh.created_at) FROM workflow_history wh
        WHERE wh.risk_id = r.id AND wh.to_stage = r.stage
      ) as stage_entered_at
      FROM risks r
      WHERE r.stage = ? AND r.created_by = ?
      ORDER BY stage_entered_at ASC
    `).all(stage, actor.id);
  }

  const items = rows.map(r => {
    const enteredAt = r.stage_entered_at ? new Date(r.stage_entered_at) : new Date(r.updated_at);
    const daysInStage = Math.floor((Date.now() - enteredAt.getTime()) / 86400000);
    const slaRemaining = slaDays - daysInStage;

    const lastH = db.prepare(
      'SELECT * FROM workflow_history WHERE risk_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(r.id);

    let mitigations = [];
    try { mitigations = JSON.parse(r.mitigations || '[]'); } catch {}

    const inherentScore = r.inherent_score || (r.impact * r.likelihood);
    const residualScore = r.residual_impact && r.residual_likelihood
      ? r.residual_impact * r.residual_likelihood : null;
    function computeLevel(s) { return s >= 15 ? 'High' : s >= 9 ? 'Medium' : s >= 4 ? 'Low' : 'Very Low'; }

    return {
      id: r.id, title: r.title, risk_statement: r.risk_statement,
      owner: r.owner, team: r.team, system: r.system_name,
      impact: r.impact, likelihood: r.likelihood,
      score: inherentScore, level: computeLevel(inherentScore),
      residual_impact: r.residual_impact || null,
      residual_likelihood: r.residual_likelihood || null,
      residual_score: residualScore,
      residual_level: residualScore ? computeLevel(residualScore) : null,
      stage: r.stage, mitigations,
      justification: r.justification || null,
      daysInStage, slaRemaining, slaBreached: slaRemaining < 0,
      awaitingSince: daysInStage === 0 ? 'just now' : `${daysInStage}d ago`,
      lastComment: lastH?.comment || null,
      commentAuthor: lastH?.actor_name || null,
    };
  });

  res.json(items);
});

module.exports = router;
