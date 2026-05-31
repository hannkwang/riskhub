// Dependency-free sliding-window rate limiter.

// rateLimiter() — Express middleware, keys by req.ip. Use for global API limits.
// createKeyedLimiter() — returns a check(key) function for per-actor limits.

function _check(log, key, limit, windowMs) {
  const now = Date.now();
  const calls = (log.get(key) || []).filter(t => now - t < windowMs);
  if (calls.length >= limit) {
    log.set(key, calls);
    return false;
  }
  calls.push(now);
  log.set(key, calls);
  // Opportunistic prune: drop keys whose entire window has expired.
  if (log.size > 5000) {
    for (const [k, ts] of log) {
      if (!ts.length || now - ts[ts.length - 1] >= windowMs) log.delete(k);
    }
  }
  return true;
}

// Express middleware — rate-limits by IP address.
function rateLimiter({ limit = 100, windowMs = 60_000 } = {}) {
  const log = new Map();
  return function (req, res, next) {
    if (!_check(log, req.ip || 'unknown', limit, windowMs)) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
  };
}

// Returns a check(key) → boolean function for endpoints that want to key by
// actor id rather than IP (e.g. the AI review endpoint).
function createKeyedLimiter({ limit = 10, windowMs = 60_000 } = {}) {
  const log = new Map();
  return (key) => _check(log, key, limit, windowMs);
}

module.exports = { rateLimiter, createKeyedLimiter };
