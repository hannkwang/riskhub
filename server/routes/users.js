const express = require('express');
const db = require('../db');
const { requireActor } = require('../lib/auth');

const router = express.Router();

// GET /api/users — public, no actor required (role-switcher needs this on load)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY name').all();
  res.json(rows);
});

const VALID_ROLES = new Set(['engineer', 'biz_owner', 'security', 'tech_governance', 'grc_chair', 'admin']);
const ADMIN_ROLES = new Set(['tech_governance', 'grc_chair', 'admin']);
const MAX_NAME_LEN = 100;
const MAX_TEAM_LEN = 500; // supports JSON arrays for multi-team biz_owners

// PATCH /api/users/:id
// Role, name, and active changes require admin.
// Team updates are self-service (any actor may update their own team).
router.patch('/:id', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor) return;

  const { role, name, team, active } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const isSelf = actor.id === user.id;
  const isAdmin = ADMIN_ROLES.has(actor.role);

  // Privileged fields: only admin may change role, name, or active status
  if (role !== undefined || name !== undefined || active !== undefined) {
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Changing role, name, or active status requires admin role',
      });
    }
  }

  // Team: actor may update their own team; admin may update anyone's
  if (team !== undefined && !isSelf && !isAdmin) {
    return res.status(403).json({ error: 'You may only update your own team' });
  }

  const updates = {};
  if (role !== undefined) {
    if (!VALID_ROLES.has(role)) {
      return res.status(400).json({ error: `Invalid role. Allowed: ${[...VALID_ROLES].join(', ')}` });
    }
    updates.role = role;
  }
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim() || name.length > MAX_NAME_LEN) {
      return res.status(400).json({ error: `name must be a non-empty string of ${MAX_NAME_LEN} characters or fewer` });
    }
    updates.name = name.trim();
  }
  if (team !== undefined) {
    // Accept array (multi-team for biz_owners) or plain string
    const teamStr = Array.isArray(team)
      ? (team.length <= 1 ? (team[0] || '') : JSON.stringify(team))
      : String(team);
    if (teamStr.length > MAX_TEAM_LEN) {
      return res.status(400).json({ error: `team value too long` });
    }
    updates.team = teamStr;
  }
  if (active !== undefined) updates.active = active ? 1 : 0;

  if (Object.keys(updates).length) {
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE users SET ${sets} WHERE id = ?`).run(...Object.values(updates), req.params.id);
    // Cascade name change to system ownership references
    if (updates.name) {
      db.prepare('UPDATE systems SET owner = ? WHERE owner = ?').run(updates.name, user.name);
    }
  }

  res.json(db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id));
});

module.exports = router;
