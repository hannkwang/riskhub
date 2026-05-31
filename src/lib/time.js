const SGT = 'Asia/Singapore';

// Parse SQLite datetime strings (space-separated, no timezone marker) as UTC
export function parseUtc(isoStr) {
  if (!isoStr) return null;
  const s = isoStr.includes('T') ? isoStr : isoStr.replace(' ', 'T');
  return new Date(s.endsWith('Z') ? s : s + 'Z');
}

export function timeAgo(isoStr) {
  const d = parseUtc(isoStr);
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function formatDate(isoStr) {
  const d = parseUtc(isoStr);
  if (!d) return '—';
  return d.toLocaleDateString('en-SG', { timeZone: SGT, day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(isoStr) {
  const d = parseUtc(isoStr);
  if (!d) return '—';
  return d.toLocaleString('en-SG', {
    timeZone: SGT, day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}
