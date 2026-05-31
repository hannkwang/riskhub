const express = require('express');
const db = require('../db');
const { requireActor } = require('../lib/auth');

const router = express.Router();

// GET /api/sla — returns all SLA settings
router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT stage, days FROM sla_settings ORDER BY stage').all();
  res.json(rows);
});

// PATCH /api/sla/:stage — update days for a stage (tech_governance only)
router.patch('/:stage', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor) return;

  if (actor.role !== 'tech_governance') {
    return res.status(403).json({ error: 'Only Tech Governance Assurance team can update SLA settings' });
  }

  const stage = decodeURIComponent(req.params.stage);
  const days = Number(req.body.days);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return res.status(400).json({ error: 'days must be an integer between 1 and 365' });
  }

  const row = db.prepare('SELECT stage FROM sla_settings WHERE stage = ?').get(stage);
  if (!row) return res.status(404).json({ error: `No SLA setting for stage: ${stage}` });

  db.prepare('UPDATE sla_settings SET days = ? WHERE stage = ?').run(days, stage);
  res.json({ stage, days });
});

module.exports = router;
