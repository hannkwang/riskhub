const express = require('express');
const db = require('../db');
const { requireActor } = require('../lib/auth');

const router = express.Router();

// GET /api/portal-settings
router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT key, value, description FROM portal_settings').all());
});

// PATCH /api/portal-settings/:key — tech_governance only
router.patch('/:key', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor) return;

  if (actor.role !== 'tech_governance') {
    return res.status(403).json({ error: 'Only Tech Governance Assurance team can update portal settings' });
  }

  const { key } = req.params;
  const row = db.prepare('SELECT * FROM portal_settings WHERE key = ?').get(key);
  if (!row) return res.status(404).json({ error: `Unknown setting: ${key}` });

  const value = Number(req.body.value);
  if (!Number.isInteger(value) || value < 1 || value > 120) {
    return res.status(400).json({ error: 'value must be an integer between 1 and 120' });
  }

  db.prepare('UPDATE portal_settings SET value = ? WHERE key = ?').run(value, key);
  res.json({ key, value, description: row.description });
});

module.exports = router;
