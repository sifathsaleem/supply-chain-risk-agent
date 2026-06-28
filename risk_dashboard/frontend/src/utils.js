export function timeAgo(dateString) {
  if (!dateString) return 'unknown';
  const date = new Date(dateString.endsWith('Z') || dateString.includes('+') ? dateString : dateString + 'Z');
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60)  return 'just now';
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return `${m} minute${m !== 1 ? 's' : ''} ago`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    return `${h} hour${h !== 1 ? 's' : ''} ago`;
  }
  const d = Math.floor(seconds / 86400);
  return `${d} day${d !== 1 ? 's' : ''} ago`;
}

export function getRiskColor(riskLevel) {
  switch (riskLevel?.toUpperCase()) {
    case 'HIGH':     return 'var(--risk-high)';
    case 'MEDIUM':   return 'var(--risk-medium)';
    case 'LOW':      return 'var(--risk-low)';
    case 'SECURITY': return 'var(--risk-security)';
    default:         return 'var(--risk-pending)';
  }
}

export function getRiskBadgeClass(riskLevel) {
  switch (riskLevel?.toUpperCase()) {
    case 'HIGH':     return 'badge badge-high';
    case 'MEDIUM':   return 'badge badge-medium';
    case 'LOW':      return 'badge badge-low';
    case 'SECURITY': return 'badge badge-security';
    default:         return 'badge badge-pending';
  }
}

export function parseSafeJson(str) {
  try { return typeof str === 'string' ? JSON.parse(str) : str; }
  catch { return {}; }
}
