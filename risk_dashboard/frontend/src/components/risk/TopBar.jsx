import React, { useState, useEffect } from 'react';

const C = {
  sc: '#232222',
  outline: '#2d2c2c',
  muted: '#a1a1a1',
};

const statCard = (label, value, accent) => (
  <div style={{ background: C.sc, border: `1px solid ${C.outline}`, borderRadius: 12, padding: '20px 24px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', color: C.muted, textTransform: 'uppercase' }}>{label}</p>
    </div>
    <p style={{ fontSize: 28, fontWeight: 700, color: accent || '#fff', lineHeight: '36px' }}>{value}</p>
  </div>
);

export default function TopBar({ riskScores = [], onSimulate, lastFetched, refreshInterval = 30000 }) {
  const [simulating, setSimulating] = useState(false);
  const sec = refreshInterval / 1000;
  const [countdown, setCountdown] = useState(sec);

  const total = riskScores.length;
  const high = riskScores.filter(r => ['HIGH', 'CRITICAL'].includes(r.risk_level?.toUpperCase())).length;
  const med = riskScores.filter(r => r.risk_level?.toUpperCase() === 'MEDIUM').length;
  const low = riskScores.filter(r => r.risk_level?.toUpperCase() === 'LOW').length;

  useEffect(() => { setCountdown(sec); }, [lastFetched, sec]);
  useEffect(() => {
    const t = setInterval(() => setCountdown(p => p <= 1 ? sec : p - 1), 1000);
    return () => clearInterval(t);
  }, [sec]);

  const handleSimulate = async () => { setSimulating(true); try { await onSimulate(); } finally { setSimulating(false); } };
  const progress = (countdown / sec) * 100;


  return (
    <div style={{ userSelect: 'none' }}>
      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', color: '#fff', marginBottom: 4 }}>Risk Intelligence Engine</h1>
          <p style={{ fontSize: 13, color: C.muted }}>Real-time threat assessment powered by Gemini + ADK</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* Countdown bar */}
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>
              REFRESHING IN {countdown}S
            </p>
            <div style={{ width: 128, height: 3, background: '#1c1b1b', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'rgba(161,161,161,0.4)', transition: 'width 1s linear', borderRadius: 99 }} />
            </div>
          </div>

          {/* Simulate button */}
          <button
            onClick={handleSimulate}
            disabled={simulating}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 20px',
              background: '#fff', color: '#000',
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              cursor: simulating ? 'not-allowed' : 'pointer',
              opacity: simulating ? 0.6 : 1,
              transition: 'opacity .15s',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bolt</span>
            {simulating ? 'Processing…' : 'Simulate Event'}
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
        {statCard('Total Suppliers', total, '#fff')}
        {statCard('High Risk', high, '#ef4444')}
        {statCard('Medium Risk', med, '#f59e0b')}
        {statCard('Low Risk', low, '#4ade80')}
      </div>
    </div>
  );
}
