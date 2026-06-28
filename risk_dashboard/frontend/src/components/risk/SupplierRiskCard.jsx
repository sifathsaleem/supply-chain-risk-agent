import React from 'react';
import { timeAgo, getRiskColor, getRiskBadgeClass, parseSafeJson } from '../../utils';

export default function SupplierRiskCard({ supplier }) {
  const riskColor = getRiskColor(supplier.risk_level);
  const badgeClass = getRiskBadgeClass(supplier.risk_level);
  const entities = parseSafeJson(supplier.entities || '{}');
  
  const isHighRisk = supplier.risk_level?.toUpperCase() === 'HIGH';
  const pulseStyle = isHighRisk ? { animation: 'pulse-high 2s infinite' } : {};

  const sentimentEmoji = {
    NEGATIVE: '😟',
    NEUTRAL: '😐',
    POSITIVE: '😊'
  }[supplier.sentiment?.toUpperCase()] || '😐';

  const confidencePct = supplier.confidence ? (supplier.confidence * 100).toFixed(0) : 0;

  return (
    <div
      className="card p-4 flex flex-col border-l-4 transition-all duration-150"
      style={{
        borderLeftColor: riskColor,
        ...pulseStyle
      }}
    >
      {/* Row 1 */}
      <div className="flex justify-between items-start gap-4">
        <h4 className="text-sm font-semibold text-text-primary">{supplier.supplier_name}</h4>
        <span className={badgeClass}>{supplier.risk_level}</span>
      </div>

      {/* Row 2 */}
      <div className="text-xs text-text-secondary mt-1">
        {supplier.country || 'Unknown Country'} &middot; {supplier.category || 'Unknown Category'}
      </div>

      {/* Row 3: Risk Score Bar */}
      <div className="mt-3">
        <div className="flex justify-between text-[11px] text-text-muted mb-1">
          <span>Risk Score</span>
          <span className="font-semibold">{supplier.risk_score} / 100</span>
        </div>
        <div className="w-full h-1 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${supplier.risk_score}%`,
              backgroundColor: riskColor
            }}
          ></div>
        </div>
      </div>

      {/* Row 4: Sentiment */}
      <div className="text-xs text-text-secondary mt-3 flex items-center gap-1.5">
        <span>{sentimentEmoji}</span>
        <span>
          {supplier.sentiment || 'NEUTRAL'} &middot; {confidencePct}% confidence
        </span>
      </div>

      {/* Row 5: Recommended Action */}
      {supplier.recommended_action && (
        <div className="text-xs text-text-secondary mt-2 bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] rounded-lg p-2.5 leading-relaxed italic">
          {supplier.recommended_action}
        </div>
      )}

      {/* Row 6: Updated Time */}
      <div className="text-[10px] text-text-muted mt-3 text-right">
        Updated {timeAgo(supplier.last_updated)}
      </div>
    </div>
  );
}
