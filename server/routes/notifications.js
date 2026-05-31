const express = require('express');
const db = require('../db');
const { requireActor } = require('../lib/auth');

const router = express.Router();

function timeAgo(isoStr) {
  if (!isoStr) return '';
  const s = isoStr.includes('T') ? isoStr : isoStr.replace(' ', 'T');
  const diff = Date.now() - new Date(s.endsWith('Z') ? s : s + 'Z').getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ACTION_LABEL = {
  submit:          'submitted for review',
  approve:         'approved',
  reject:          'rejected',
  request_changes: 'requested changes',
  route_back:      'routed back',
  raiser_respond:  'responded',
  auto_approve:    'fully approved',
};

// GET /api/notifications
// Returns recent workflow events relevant to the requesting user's role.
// Optional ?since=ISO to annotate items as new/seen.
router.get('/', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor) return;

  const { since } = req.query;
  const sinceFilter = since || null;

  let rows = [];

  if (actor.role === 'engineer') {
    // Actions taken by others on risks this user created
    rows = db.prepare(`
      SELECT wh.id, wh.risk_id, wh.action, wh.actor_name, wh.comment,
             wh.from_stage, wh.to_stage, wh.created_at, r.title as risk_title
      FROM workflow_history wh
      JOIN risks r ON r.id = wh.risk_id
      WHERE r.created_by = ?
        AND wh.actor_id != ?
        AND wh.action NOT IN ('create','ai_review')
      ORDER BY wh.created_at DESC LIMIT 20
    `).all(actor.id, actor.id);

  } else if (actor.role === 'biz_owner') {
    // Any activity on risks belonging to systems this user owns
    rows = db.prepare(`
      SELECT wh.id, wh.risk_id, wh.action, wh.actor_name, wh.comment,
             wh.from_stage, wh.to_stage, wh.created_at, r.title as risk_title
      FROM workflow_history wh
      JOIN risks r ON r.id = wh.risk_id
      JOIN systems s ON s.name = r.system_name AND s.owner = ?
      WHERE wh.action NOT IN ('create','ai_review')
        AND wh.actor_id != ?
      ORDER BY wh.created_at DESC LIMIT 20
    `).all(actor.name, actor.id);

  } else {
    // security / tech_governance / grc_chair:
    // Activity on risks where this person has a concurrent_approvals row
    rows = db.prepare(`
      SELECT wh.id, wh.risk_id, wh.action, wh.actor_name, wh.comment,
             wh.from_stage, wh.to_stage, wh.created_at, r.title as risk_title
      FROM workflow_history wh
      JOIN risks r ON r.id = wh.risk_id
      JOIN concurrent_approvals ca ON ca.risk_id = r.id AND ca.actor_id = ?
      WHERE wh.action NOT IN ('create','ai_review')
        AND wh.actor_id != ?
      ORDER BY wh.created_at DESC LIMIT 20
    `).all(actor.id, actor.id);
  }

  const items = rows.map(r => ({
    id:         r.id,
    risk_id:    r.risk_id,
    risk_title: r.risk_title,
    action:     r.action,
    actor_name: r.actor_name,
    label:      ACTION_LABEL[r.action] || r.action.replace('_', ' '),
    comment:    r.comment,
    from_stage: r.from_stage,
    to_stage:   r.to_stage,
    created_at: r.created_at,
    time_ago:   timeAgo(r.created_at),
    is_new:     sinceFilter ? r.created_at > sinceFilter : false,
  }));

  res.json(items);
});

module.exports = router;
