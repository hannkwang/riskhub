const express = require('express');
const db = require('../db');
const { reviewRisk } = require('../lib/claude');
const { getActor } = require('../lib/auth');

const router = express.Router();

// In-memory rate limiter: max 10 review calls per actor (or IP if unauthenticated)
// per minute. Keying on the actor prevents one user from starving others on the
// same proxy/NAT IP; keying on IP for unauthenticated requests still throttles
// anonymous probes. The map is pruned on every check so entries do not grow
// unboundedly with new IPs/actors.
const reviewCallLog = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(key) {
  const now = Date.now();
  const calls = (reviewCallLog.get(key) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (calls.length >= RATE_LIMIT) {
    reviewCallLog.set(key, calls);
    return false;
  }
  calls.push(now);
  reviewCallLog.set(key, calls);

  // Opportunistic prune: drop any keys whose windows have fully expired.
  if (reviewCallLog.size > 1000) {
    for (const [k, ts] of reviewCallLog) {
      if (!ts.length || now - ts[ts.length - 1] >= RATE_WINDOW_MS) {
        reviewCallLog.delete(k);
      }
    }
  }
  return true;
}

// Input length caps to prevent excessive token consumption
const MAX_STATEMENT_LEN = 2000;
const MAX_FIELD_LEN = 500;

function truncate(str, max) {
  if (typeof str !== 'string') return str;
  return str.length > max ? str.substring(0, max) : str;
}

// POST /api/review
router.post('/', async (req, res) => {
  const actor = getActor(req);
  const rateKey = actor ? `u:${actor.id}` : `ip:${req.ip}`;
  if (!checkRateLimit(rateKey)) {
    return res.status(429).json({ error: 'Too many review requests. Please wait a minute and try again.' });
  }

  const { risk_id, systemName, statement, impact, likelihood, residual_impact, residual_likelihood, mitigations, justification } = req.body;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  // System metadata (criticality + internet_facing) comes from the DB, not the
  // request body — otherwise a submitter could lie about internet_facing to
  // bypass BP-042's likelihood floor in the AI review.
  const truncatedSystemName = truncate(systemName, MAX_FIELD_LEN);
  const systemRow = truncatedSystemName
    ? db.prepare('SELECT criticality, internet_facing FROM systems WHERE name = ?').get(truncatedSystemName)
    : null;

  try {
    const result = await reviewRisk({
      systemName: truncatedSystemName || 'Unknown system',
      internetFacing: systemRow ? Boolean(systemRow.internet_facing) : false,
      criticality: systemRow?.criticality || 'Unknown',
      statement: truncate(statement, MAX_STATEMENT_LEN),
      impact: Number(impact) || 1,
      likelihood: Number(likelihood) || 1,
      residualImpact: Number(residual_impact) || null,
      residualLikelihood: Number(residual_likelihood) || null,
      mitigations: Array.isArray(mitigations) ? mitigations.slice(0, 20) : [],
      justification: truncate(justification, MAX_STATEMENT_LEN),
    });

    // Persist the AI review if linked to a risk
    if (risk_id) {
      db.prepare(`
        INSERT INTO workflow_history (risk_id, from_stage, to_stage, actor_id, actor_name, action, comment)
        SELECT ?, stage, stage, 'ai', 'AI Review', 'ai_review', ?
        FROM risks WHERE id = ?
      `).run(risk_id, `AI review completed. ${result.flags?.length || 0} flags, ${result.suggestions?.length || 0} suggestions.`, risk_id);
    }

    res.json(result);
  } catch (err) {
    console.error('Claude review error:', err);
    res.status(500).json({ error: 'AI review failed. Please try again.' });
  }
});

module.exports = router;
