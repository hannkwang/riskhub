const express = require('express');
const db = require('../db');

const router = express.Router();

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function round1(n) { return n === null ? null : Math.round(n * 10) / 10; }

function daysFrom(isoStr) {
  if (!isoStr) return null;
  return Math.max(0, (Date.now() - new Date(isoStr).getTime()) / 86400000);
}

// GET /api/analytics
router.get('/', (req, res) => {
  // --- KPIs ---
  const totalOpen = db.prepare(
    "SELECT COUNT(*) as n FROM risks WHERE stage NOT IN ('Approved','Rejected')"
  ).get().n;
  const inConcurrent = db.prepare(
    "SELECT COUNT(*) as n FROM risks WHERE stage = 'Concurrent Review'"
  ).get().n;
  const inSystemOwner = db.prepare(
    "SELECT COUNT(*) as n FROM risks WHERE stage = 'System Owner'"
  ).get().n;
  const approved = db.prepare(
    "SELECT COUNT(*) as n FROM risks WHERE stage = 'Approved'"
  ).get().n;
  const totalRisks = db.prepare('SELECT COUNT(*) as n FROM risks').get().n;

  // Stuck = in any non-terminal stage for >7 days
  const stuckCount = db.prepare(`
    SELECT COUNT(*) as n FROM risks
    WHERE stage NOT IN ('Approved','Rejected')
    AND CAST(julianday('now') - julianday(updated_at) AS INTEGER) > 7
  `).get().n;

  const kpi = { totalOpen, inConcurrent, inSystemOwner, approved, totalRisks, stuckCount };

  // --- Pending approvals per person ---
  // System Owner queue: all risks in System Owner stage
  const systemOwnerRisks = db.prepare(`
    SELECT r.id, r.title,
      ROUND(julianday('now') - julianday(
        COALESCE(
          (SELECT MAX(wh.created_at) FROM workflow_history wh WHERE wh.risk_id = r.id AND wh.to_stage = 'System Owner'),
          r.updated_at
        )
      ), 1) as days_waiting
    FROM risks r
    WHERE r.stage = 'System Owner'
    ORDER BY days_waiting DESC
  `).all();

  // Concurrent review: pending per person (only risks where team hasn't approved yet for team-based roles)
  const concurrentPendingByPerson = db.prepare(`
    SELECT ca.actor_id, ca.role, u.name,
      COUNT(*) as pending_count,
      ROUND(AVG(
        julianday('now') - julianday(
          COALESCE(
            (SELECT MAX(wh.created_at) FROM workflow_history wh
             WHERE wh.risk_id = r.id AND wh.to_stage = 'Concurrent Review'),
            r.updated_at
          )
        )
      ), 1) as avg_days_waiting,
      MAX(
        julianday('now') - julianday(
          COALESCE(
            (SELECT MAX(wh.created_at) FROM workflow_history wh
             WHERE wh.risk_id = r.id AND wh.to_stage = 'Concurrent Review'),
            r.updated_at
          )
        )
      ) as max_days_waiting
    FROM concurrent_approvals ca
    JOIN users u ON u.id = ca.actor_id
    JOIN risks r ON r.id = ca.risk_id AND r.stage = 'Concurrent Review'
    WHERE ca.status = 'pending'
    GROUP BY ca.actor_id, ca.role, u.name
    ORDER BY ca.role, avg_days_waiting DESC
  `).all().map(r => ({ ...r, avg_days_waiting: round1(r.avg_days_waiting), max_days_waiting: round1(r.max_days_waiting) }));

  // --- In-flight risks with full status ---
  const inFlightRisks = db.prepare(`
    SELECT r.id, r.title, r.stage, r.impact, r.likelihood, r.inherent_score,
      r.owner, r.team,
      ROUND(julianday('now') - julianday(
        COALESCE(
          (SELECT MAX(wh.created_at) FROM workflow_history wh WHERE wh.risk_id = r.id AND wh.to_stage = r.stage),
          r.updated_at
        )
      ), 1) as days_in_stage
    FROM risks r
    WHERE r.stage NOT IN ('Approved','Rejected')
    ORDER BY days_in_stage DESC, r.stage
  `).all();

  // Attach concurrent approval status to each Concurrent Review risk
  const inFlight = inFlightRisks.map(r => {
    if (r.stage !== 'Concurrent Review') return r;
    const approvals = db.prepare(`
      SELECT ca.role, ca.status, u.name as actor_name, ca.comment, ca.updated_at
      FROM concurrent_approvals ca
      JOIN users u ON u.id = ca.actor_id
      WHERE ca.risk_id = ?
      ORDER BY ca.role, u.name
    `).all(r.id);
    return { ...r, approvals };
  });

  // --- Stage timing (median days spent at each stage, from completed transitions) ---
  const stageTiming = ['System Owner', 'Concurrent Review'].map(stage => {
    const exits = db.prepare(`
      SELECT wh_enter.created_at as entered, wh_exit.created_at as exited
      FROM workflow_history wh_exit
      JOIN workflow_history wh_enter ON wh_enter.risk_id = wh_exit.risk_id
        AND wh_enter.to_stage = ? AND wh_enter.created_at < wh_exit.created_at
      WHERE wh_exit.from_stage = ? AND wh_exit.to_stage != ?
      GROUP BY wh_exit.risk_id
    `).all(stage, stage, stage);

    const durations = exits.map(e =>
      Math.max(0, (new Date(e.exited) - new Date(e.entered)) / 86400000)
    );

    // Current waiting times for open items
    const openWaits = db.prepare(`
      SELECT ROUND(julianday('now') - julianday(
        COALESCE(
          (SELECT MAX(wh.created_at) FROM workflow_history wh WHERE wh.risk_id = r.id AND wh.to_stage = ?),
          r.updated_at
        )
      ), 1) as days
      FROM risks r WHERE r.stage = ?
    `).all(stage, stage).map(r => r.days).filter(d => d >= 0);

    return {
      stage,
      completedCount: durations.length,
      medianDays: round1(median(durations)),
      openCount: openWaits.length,
      avgOpenDays: round1(openWaits.length ? openWaits.reduce((a, b) => a + b, 0) / openWaits.length : null),
      maxOpenDays: round1(openWaits.length ? Math.max(...openWaits) : null),
    };
  });

  // --- Route-back frequency per reviewer ---
  const routeBacksByPerson = db.prepare(`
    SELECT actor_id, actor_name,
      COUNT(*) as route_back_count
    FROM workflow_history
    WHERE action = 'route_back'
    GROUP BY actor_id, actor_name
    ORDER BY route_back_count DESC
  `).all();

  res.json({ kpi, systemOwnerRisks, concurrentPendingByPerson, inFlight, stageTiming, routeBacksByPerson });
});

module.exports = router;
