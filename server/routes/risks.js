const express = require('express');
const db = require('../db');
const { requireActor, getActor } = require('../lib/auth');

const router = express.Router();

function computeLevel(score) {
  if (score >= 15) return 'High';
  if (score >= 9)  return 'Medium';
  if (score >= 4)  return 'Low';
  return 'Very Low';
}

function parseUtc(s) { const t = s.includes('T') ? s : s.replace(' ', 'T'); return new Date(t.endsWith('Z') ? t : t + 'Z'); }
function timeAgo(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - parseUtc(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)   return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24)  return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatRisk(r) {
  const score = r.inherent_score || (r.impact * r.likelihood);
  const level = computeLevel(score);
  let mitigations = [];
  try { mitigations = JSON.parse(r.mitigations || '[]'); } catch {}
  return {
    id: r.id,
    title: r.title,
    risk_statement: r.risk_statement,
    owner: r.owner,
    team: r.team,
    system: r.system_name,
    impact: r.impact,
    likelihood: r.likelihood,
    score,
    level,
    inherent_score: score,
    residual_impact: r.residual_impact,
    residual_likelihood: r.residual_likelihood,
    residual_score: r.residual_score,
    residual_level: r.residual_score ? computeLevel(r.residual_score) : null,
    ai_residual_impact: r.ai_residual_impact,
    ai_residual_likelihood: r.ai_residual_likelihood,
    ai_residual_score: r.ai_residual_impact && r.ai_residual_likelihood ? r.ai_residual_impact * r.ai_residual_likelihood : null,
    ai_residual_level: r.ai_residual_impact && r.ai_residual_likelihood ? computeLevel(r.ai_residual_impact * r.ai_residual_likelihood) : null,
    mitigations,
    justification: r.justification,
    review_period_months: r.review_period_months,
    stage: r.stage,
    created_by: r.created_by,
    created_at: r.created_at,
    updated_at: r.updated_at,
    updated: timeAgo(r.updated_at),
    expires_at: r.expires_at,
    expiresAt: r.expires_at,
  };
}

// GET /api/risks
router.get('/', (req, res) => {
  const actor = getActor(req);
  const { stage, level, owner, created_by } = req.query;
  let sql = 'SELECT * FROM risks WHERE 1=1';
  const params = [];

  if (stage) {
    // Support comma-separated list of stages
    const stages = stage.split(',').map(s => s.trim());
    sql += ` AND stage IN (${stages.map(() => '?').join(',')})`;
    params.push(...stages);
  }
  // level filter is applied post-query (it is computed, not stored); do not add a SQL clause
  if (owner) { sql += ' AND owner = ?'; params.push(owner); }
  if (created_by) { sql += ' AND created_by = ?'; params.push(created_by); }

  // Role-based visibility: engineers see only their own risks; system owners
  // see only risks for systems they own (plus draft privacy for both).
  // All other roles (security, TGA, GRC, admin) retain full visibility.
  if (actor) {
    if (actor.role === 'engineer') {
      sql += ' AND created_by = ?';
      params.push(actor.id);
    } else if (actor.role === 'biz_owner') {
      sql += " AND (stage != 'Draft' OR created_by = ?) AND system_name IN (SELECT name FROM systems WHERE owner = ?)";
      params.push(actor.id, actor.name);
    } else {
      sql += " AND (stage != 'Draft' OR created_by = ?)";
      params.push(actor.id);
    }
  } else {
    sql += " AND stage != 'Draft'";
  }

  sql += ' ORDER BY updated_at DESC';
  const rows = db.prepare(sql).all(...params);
  const risks = rows.map(formatRisk);

  // Apply level filter post-query since it's computed
  const filtered = level ? risks.filter(r => r.level === level) : risks;
  res.json(filtered);
});

// A Draft is private to its creator for BOTH reads and writes. Admins get no
// bypass: the list query and GET /:id hide other users' Drafts, so an admin could
// never load one to act on it anyway. Keeping one predicate avoids the read/write
// rules drifting apart. Returns true when the Draft must be hidden from `actor`.
function isHiddenDraft(actor, row) {
  return row.stage === 'Draft' && (!actor || actor.id !== row.created_by);
}

// GET /api/risks/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Risk not found' });
  if (isHiddenDraft(getActor(req), row)) {
    return res.status(404).json({ error: 'Risk not found' });
  }
  res.json(formatRisk(row));
});

function validScore(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

// POST /api/risks
router.post('/', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor) return;

  const {
    title, risk_statement, owner, team, system_name,
    impact = 1, likelihood = 1,
    residual_impact, residual_likelihood,
    ai_residual_impact, ai_residual_likelihood,
    mitigations = [], justification,
    review_period_months = 6,
  } = req.body;

  if (!title && !risk_statement) {
    return res.status(400).json({ error: 'title or risk_statement required' });
  }

  if (!validScore(impact) || !validScore(likelihood)) {
    return res.status(400).json({ error: 'impact and likelihood must be integers between 1 and 5' });
  }
  if (residual_impact !== undefined && residual_impact !== null && !validScore(residual_impact)) {
    return res.status(400).json({ error: 'residual_impact must be an integer between 1 and 5' });
  }
  if (residual_likelihood !== undefined && residual_likelihood !== null && !validScore(residual_likelihood)) {
    return res.status(400).json({ error: 'residual_likelihood must be an integer between 1 and 5' });
  }
  const months = Number(review_period_months);
  if (!Number.isInteger(months) || months < 1 || months > 60) {
    return res.status(400).json({ error: 'review_period_months must be an integer between 1 and 60' });
  }

  // Generate next RA ID — sort numerically by the sequence portion (substr from pos 9)
  // so that RA-2026-100 correctly sorts after RA-2026-099 and RA-2026-9.
  const last = db.prepare(
    "SELECT id FROM risks WHERE id LIKE 'RA-____-%' ORDER BY CAST(substr(id, 9) AS INTEGER) DESC, id DESC LIMIT 1"
  ).get();
  let nextNum = 1;
  if (last) {
    const match = last.id.match(/RA-(\d+)-(\d+)/);
    if (match) nextNum = parseInt(match[2]) + 1;
  }
  const year = new Date().getFullYear();
  const id = `RA-${year}-${String(nextNum).padStart(3, '0')}`;

  const inherentScore = impact * likelihood;
  const residualScore = residual_impact && residual_likelihood
    ? residual_impact * residual_likelihood : null;

  const derivedTitle = title || risk_statement.substring(0, 70);

  db.prepare(`
    INSERT INTO risks
      (id, title, risk_statement, owner, team, system_name,
       impact, likelihood, inherent_score,
       residual_impact, residual_likelihood, residual_score,
       ai_residual_impact, ai_residual_likelihood,
       mitigations, justification, review_period_months, stage, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?)
  `).run(
    id, derivedTitle, risk_statement, owner, team, system_name,
    impact, likelihood, inherentScore,
    residual_impact || null, residual_likelihood || null, residualScore,
    ai_residual_impact || null, ai_residual_likelihood || null,
    JSON.stringify(mitigations), justification, review_period_months, actor.id,
  );

  // Log creation in history — actor identity is taken from the server-side
  // auth helper, never from the request body, so callers cannot forge attribution.
  db.prepare(`
    INSERT INTO workflow_history (risk_id, from_stage, to_stage, actor_id, actor_name, action, comment)
    VALUES (?, null, 'Draft', ?, ?, 'create', 'Risk assessment created')
  `).run(id, actor.id, actor.name);

  const created = db.prepare('SELECT * FROM risks WHERE id = ?').get(id);
  res.status(201).json(formatRisk(created));
});

// PATCH /api/risks/:id
const TERMINAL_STAGES = new Set(['Approved', 'Rejected']);
const RISK_ADMIN_ROLES = new Set(['tech_governance', 'grc_chair', 'admin']);

router.patch('/:id', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor) return;

  const row = db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Risk not found' });

  // Draft privacy applies to writes exactly as it does to reads (see isHiddenDraft):
  // only the creator may edit a Draft. Return 404 — not 403 — so the endpoint does
  // not leak the existence of another user's draft.
  if (isHiddenDraft(actor, row)) {
    return res.status(404).json({ error: 'Risk not found' });
  }

  // Approved/Rejected risks are immutable — any change requires re-opening
  // the workflow via a transition, so the audit log captures the event.
  if (TERMINAL_STAGES.has(row.stage)) {
    return res.status(409).json({
      error: `Risk is ${row.stage}; cannot be edited. Re-open via the workflow to modify.`,
    });
  }

  const allowed = [
    'title', 'risk_statement', 'owner', 'team', 'system_name',
    'impact', 'likelihood', 'residual_impact', 'residual_likelihood',
    'mitigations', 'justification', 'review_period_months',
  ];
  const updates = {};
  allowed.forEach(k => {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  });

  if (updates.mitigations !== undefined) {
    // Mitigations must always be an array. Reject malformed payloads early
    // so they cannot crash the frontend's .map() later.
    if (!Array.isArray(updates.mitigations)) {
      return res.status(400).json({ error: 'mitigations must be an array' });
    }
    updates.mitigations = JSON.stringify(updates.mitigations);
  }

  if (Object.keys(updates).length === 0) {
    return res.json(formatRisk(row));
  }

  // Validate numeric fields
  for (const field of ['impact', 'likelihood', 'residual_impact', 'residual_likelihood']) {
    if (updates[field] !== undefined && updates[field] !== null && !validScore(updates[field])) {
      return res.status(400).json({ error: `${field} must be an integer between 1 and 5` });
    }
  }
  if (updates.review_period_months !== undefined) {
    const m = Number(updates.review_period_months);
    if (!Number.isInteger(m) || m < 1 || m > 60) {
      return res.status(400).json({ error: 'review_period_months must be an integer between 1 and 60' });
    }
  }

  // Recompute scores if needed
  const impact = updates.impact ?? row.impact;
  const likelihood = updates.likelihood ?? row.likelihood;
  updates.inherent_score = impact * likelihood;

  const ri = updates.residual_impact ?? row.residual_impact;
  const rl = updates.residual_likelihood ?? row.residual_likelihood;
  if (ri && rl) updates.residual_score = ri * rl;

  updates.updated_at = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE risks SET ${sets} WHERE id = ?`).run(...Object.values(updates), req.params.id);

  const updated = db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id);
  res.json(formatRisk(updated));
});

// DELETE /api/risks/:id — restricted to tech_governance and grc_chair
router.delete('/:id', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor) return;

  if (!RISK_ADMIN_ROLES.has(actor.role)) {
    return res.status(403).json({ error: 'Only Tech Governance Assurance or GRC Co-Chair can remove risk acceptances' });
  }

  const row = db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Risk not found' });

  db.transaction(() => {
    db.prepare('DELETE FROM concurrent_approvals WHERE risk_id = ?').run(req.params.id);
    db.prepare('DELETE FROM workflow_history WHERE risk_id = ?').run(req.params.id);
    db.prepare('DELETE FROM risks WHERE id = ?').run(req.params.id);
  })();

  res.json({ deleted: req.params.id });
});

module.exports = router;
