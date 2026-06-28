import React from 'react';
import SupplierRiskCard from './SupplierRiskCard';
import { BarChart3 } from 'lucide-react';

export default function RiskScoreboard({ data = [], loading }) {
  // Sort data: HIGH first, MEDIUM second, LOW last, others last
  const sorted = [...data].sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (order[a.risk_level?.toUpperCase()] ?? 3) - (order[b.risk_level?.toUpperCase()] ?? 3);
  });

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="card p-4 flex flex-col gap-3 min-h-[140px]">
            <div className="flex justify-between items-center">
              <div className="skeleton h-5 w-32"></div>
              <div className="skeleton h-5 w-16"></div>
            </div>
            <div className="skeleton h-4 w-40"></div>
            <div className="flex flex-col gap-1.5 mt-2">
              <div className="flex justify-between">
                <div className="skeleton h-3.5 w-12"></div>
                <div className="skeleton h-3.5 w-16"></div>
              </div>
              <div className="skeleton h-2 w-full"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 text-center py-12 text-text-secondary">
        <BarChart3 className="size-8 text-text-muted" />
        <p className="text-sm font-medium">No risk data yet.</p>
        <p className="text-xs text-text-muted">Add suppliers and run a scan to populate the scoreboard.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((supplier, idx) => (
        <SupplierRiskCard key={idx} supplier={supplier} />
      ))}
    </div>
  );
}
