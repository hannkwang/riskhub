const express = require('express');
const db = require('../db');

const router = express.Router();

const CRITICALITY = new Set(['Critical', 'High', 'Medium', 'Low']);
const SENSITIVITY = new Set(['Restricted', 'Confidential', 'Internal', 'Public']);
const RML = new Set(['High', 'Medium', 'Low']);
const MAX_TEXT = 200;

function validateString(value, field, max = MAX_TEXT) {
  if (typeof value !== 'string') return `${field} must be a string`;
  if (value.length > max) return `${field} must be ${max} characters or fewer`;
  return null;
}

// GET /api/systems
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM systems ORDER BY criticality, name').all();
  // Attach open risk count per system
  const withCounts = rows.map(s => {
    const openRAs = db.prepare(
      "SELECT COUNT(*) as n FROM risks WHERE system_name = ? AND stage NOT IN ('Approved','Rejected')"
    ).get(s.name)?.n || 0;
    return { ...s, internet_facing: Boolean(s.internet_facing), openRAs };
  });
  res.json(withCounts);
});

// PATCH /api/systems/:id
router.patch('/:id', (req, res) => {
  const allowed = ['criticality', 'sensitivity', 'internet_facing', 'owner', 'team', 'rml'];
  const updates = {};
  for (const k of allowed) {
    if (req.body[k] === undefined) continue;
    updates[k] = req.body[k];
  }

  if (updates.criticality !== undefined && !CRITICALITY.has(updates.criticality)) {
    return res.status(400).json({ error: `criticality must be one of: ${[...CRITICALITY].join(', ')}` });
  }
  if (updates.sensitivity !== undefined && !SENSITIVITY.has(updates.sensitivity)) {
    return res.status(400).json({ error: `sensitivity must be one of: ${[...SENSITIVITY].join(', ')}` });
  }
  if (updates.rml !== undefined && !RML.has(updates.rml)) {
    return res.status(400).json({ error: `rml must be one of: ${[...RML].join(', ')}` });
  }
  if (updates.internet_facing !== undefined) {
    updates.internet_facing = updates.internet_facing ? 1 : 0;
  }
  for (const field of ['owner', 'team']) {
    if (updates[field] !== undefined) {
      const err = validateString(updates[field], field);
      if (err) return res.status(400).json({ error: err });
    }
  }

  if (Object.keys(updates).length) {
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE systems SET ${sets} WHERE id = ?`).run(...Object.values(updates), req.params.id);
  }

  const row = db.prepare('SELECT * FROM systems WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'System not found' });
  res.json({ ...row, internet_facing: Boolean(row.internet_facing) });
});

module.exports = router;
