const db = require('../db');

// Demo-mode "auth": the frontend sends X-Riskhub-User with the role-switcher's
// current user id. This is a single boundary so that when real authentication
// (cookie/JWT) is bolted on, only this file changes — every route reads the
// acting user through getActor(req) instead of trusting req.body.actor_id.
function getActor(req) {
  const id = req.get('X-Riskhub-User');
  if (!id) return null;
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
}

function requireActor(req, res) {
  const actor = getActor(req);
  if (!actor) {
    res.status(401).json({ error: 'Missing or unknown X-Riskhub-User header' });
    return null;
  }
  return actor;
}

module.exports = { getActor, requireActor };
