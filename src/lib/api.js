const BASE = '/api';

// The role-switcher writes the active user id here; every API call attaches it
// as X-Riskhub-User so the server has a single trusted source for "who is acting".
function currentActorId() {
  try { return localStorage.getItem('riskhub_user') || ''; }
  catch { return ''; }
}

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const actorId = currentActorId();
  if (actorId) headers['X-Riskhub-User'] = actorId;

  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Risks
  getRisks:   (params = {}) => req('GET', `/risks?${new URLSearchParams(params)}`),
  getRisk:    (id)          => req('GET', `/risks/${id}`),
  createRisk: (body)        => req('POST', '/risks', body),
  updateRisk: (id, body)    => req('PATCH', `/risks/${id}`, body),
  deleteRisk: (id)          => req('DELETE', `/risks/${id}`),

  // Workflow
  getHistory:         (id)         => req('GET',  `/workflow/${id}/history`),
  transition:         (id, body)   => req('POST', `/workflow/${id}/transition`, body),
  getQueue:           (role)       => req('GET',  `/workflow/queue/${role}`),
  getConcurrentStatus:(id)         => req('GET',  `/workflow/${id}/concurrent-status`),
  concurrentAction:   (id, body)   => req('POST', `/workflow/${id}/concurrent`, body),
  raiserRespond:      (id, body)   => req('POST', `/workflow/${id}/raiser-respond`, body),

  // AI Review
  reviewRisk: (body) => req('POST', '/review', body),

  // Analytics
  getAnalytics: (params = {}) => req('GET', `/analytics?${new URLSearchParams(params)}`),


  // Users
  getUsers:   ()        => req('GET', '/users'),
  updateUser: (id, body) => req('PATCH', `/users/${id}`, body),

  // Systems
  getSystems:   ()         => req('GET', '/systems'),
  updateSystem: (id, body) => req('PATCH', `/systems/${id}`, body),

  // SLA settings
  getSla:    ()              => req('GET', '/sla'),
  updateSla: (stage, days)   => req('PATCH', `/sla/${encodeURIComponent(stage)}`, { days }),

  // Notifications
  getNotifications: (since) => req('GET', `/notifications${since ? `?since=${encodeURIComponent(since)}` : ''}`),

  // Portal settings
  getPortalSettings:    ()              => req('GET', '/portal-settings'),
  updatePortalSetting:  (key, value)    => req('PATCH', `/portal-settings/${encodeURIComponent(key)}`, { value }),
};
