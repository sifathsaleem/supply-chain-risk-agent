import React, { useState, useEffect } from 'react';
import { Zap, Loader2 } from 'lucide-react';

export default function TopBar({ riskScores = [], onSimulate, lastFetched }) {
  const [simulating, setSimulating] = useState(false);
  const [countdown, setCountdown] = useState(30);

  const total = riskScores.length;
  const high  = riskScores.filter(r => r.risk_level === 'HIGH').length;
  const med   = riskScores.filter(r => r.risk_level === 'MEDIUM').length;
  const low   = riskScores.filter(r => r.risk_level === 'LOW').length;

  useEffect(() => {
    setCountdown(30);
  }, [lastFetched]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return 30;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSimulateClick = async () => {
    setSimulating(true);
    try {
      await onSimulate();
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="px-6 py-3 border-b border-[var(--border-card)] bg-[rgba(10,10,15,0.4)] backdrop-blur-xs flex items-center justify-between gap-4 flex-wrap shrink-0">
      {/* Stats Chips */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="bg-bg-card border border-border-card rounded-full px-3 py-1 text-xs text-white">
          Total: <span className="font-bold">{total}</span>
        </div>
        <div className="bg-bg-card border border-border-card rounded-full px-3 py-1 text-xs text-risk-high">
          High: <span className="font-bold">{high}</span>
        </div>
        <div className="bg-bg-card border border-border-card rounded-full px-3 py-1 text-xs text-risk-medium">
          Medium: <span className="font-bold">{med}</span>
        </div>
        <div className="bg-bg-card border border-border-card rounded-full px-3 py-1 text-xs text-risk-low">
          Low: <span className="font-bold">{low}</span>
        </div>
      </div>

      {/* Countdown and Simulation Trigger */}
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end gap-1.5 w-32">
          <div className="text-[11px] text-text-muted">
            Refreshing in <span className="font-semibold text-text-secondary">{countdown}s</span>
          </div>
          <div className="w-full h-[2px] bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-blue rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${(countdown / 30) * 100}%` }}
            ></div>
          </div>
        </div>

        <button
          onClick={handleSimulateClick}
          disabled={simulating}
          className="btn btn-primary cursor-pointer flex items-center gap-2"
        >
          {simulating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Zap className="size-4" />
          )}
          {simulating ? 'Publishing...' : 'Simulate Event'}
        </button>
      </div>
    </div>
  );
}
