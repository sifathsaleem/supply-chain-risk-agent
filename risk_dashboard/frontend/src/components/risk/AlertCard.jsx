import React from 'react';
import { timeAgo, getRiskColor, getRiskBadgeClass } from '../../utils';

export default function AlertCard({ alert }) {
  const isHighRisk = alert.risk_level?.toUpperCase() === 'HIGH';
  const isSecurity = alert.alert_message?.includes('SECURITY');

  let borderLeftColor = 'var(--risk-low)';
  if (isSecurity) {
    borderLeftColor = 'var(--risk-security)';
  } else if (isHighRisk) {
    borderLeftColor = 'var(--risk-high)';
  } else if (alert.risk_level?.toUpperCase() === 'MEDIUM') {
    borderLeftColor = 'var(--risk-medium)';
  }

  let animation = 'none';
  if (isSecurity) {
    animation = 'pulse-security 2s infinite';
  } else if (isHighRisk) {
    animation = 'pulse-high 2s infinite';
  }

  const badgeLevel = isSecurity ? 'SECURITY' : alert.risk_level;

  return (
    <div
      className="card p-4 border-l-4"
      style={{ borderLeftColor, animation }}
    >
      {/* Row 1 */}
      <div className="flex justify-between items-start gap-4">
        <span className="font-semibold text-sm text-text-primary">{alert.supplier_name}</span>
        <span className={getRiskBadgeClass(badgeLevel)}>{badgeLevel}</span>
      </div>

      {/* Row 2 */}
      <div className="text-[10px] text-text-muted mt-1">
        {timeAgo(alert.timestamp)}
      </div>

      {/* Row 3 */}
      <div className="text-xs text-text-secondary leading-relaxed mt-2">
        {alert.alert_message}
      </div>
    </div>
  );
}
