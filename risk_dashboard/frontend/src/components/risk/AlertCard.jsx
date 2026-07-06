import React, { useState } from 'react';
import { timeAgo } from '../../utils';
import { ShieldAlert, TrendingDown, AlertTriangle, Globe, Anchor, Bell } from 'lucide-react';

const C = {
  scLow:     '#1c1b1b',
  scHighest: '#363535',
  outline:   '#2d2c2c',
  muted:     '#a1a1a1',
};

function getAlertCategory(alert) {
  const msg = (alert.alert_message || '').toLowerCase();
  const entities = (() => {
    try { return JSON.parse(alert.entities || '[]'); }
    catch { return []; }
  })();
  const allText = msg + ' ' + entities.join(' ');

  if (alert.risk_level === 'SECURITY' ||
      allText.includes('security') ||
      allText.includes('injection')) {
    return {
      label: 'SECURITY EVENT',
      color: '#f97316',
      Icon: ShieldAlert
    };
  }
  if (allText.includes('bankrupt') || allText.includes('financial') ||
      allText.includes('credit') || allText.includes('liquidit')) {
    return {
      label: 'FINANCIAL ALERT',
      color: '#f59e0b',
      Icon: TrendingDown
    };
  }
  if (allText.includes('flood') || allText.includes('fire') ||
      allText.includes('earthquake') || allText.includes('storm') ||
      allText.includes('factory') || allText.includes('production')) {
    return {
      label: 'OPERATIONAL ALERT',
      color: '#f97316',
      Icon: AlertTriangle
    };
  }
  if (allText.includes('strike') || allText.includes('unrest') ||
      allText.includes('political') || allText.includes('protest')) {
    return {
      label: 'GEOPOLITICAL',
      color: '#3b82f6',
      Icon: Globe
    };
  }
  if (allText.includes('port') || allText.includes('shipping') ||
      allText.includes('logistics') || allText.includes('freight') ||
      allText.includes('closure') || allText.includes('semiconductor')) {
    return {
      label: 'LOGISTICS ALERT',
      color: '#8b5cf6',
      Icon: Anchor
    };
  }
  return {
    label: 'SUPPLY CHAIN ALERT',
    color: '#94a3b8',
    Icon: Bell
  };
}

export default function AlertCard({ alert, interactive }) {
  const [hovered, setHovered] = useState(false);
  const critical = ['HIGH', 'CRITICAL', 'SECURITY'].includes(alert.risk_level?.toUpperCase());
  const category = getAlertCategory(alert);

  return (
    <div
      onMouseEnter={() => interactive && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: 16, borderRadius: 8, marginBottom: 12,
        background: hovered && interactive ? 'rgba(255,255,255,0.07)' : (critical ? C.scHighest : C.scLow),
        border: `1px solid ${C.outline}`,
        transition: 'background 0.15s ease',
        ...(critical ? { boxShadow: '0 0 14px -3px rgba(239,68,68,.1)', animation: 'pulse-subtle 3s ease infinite' } : {}),
      }}
    >
      {/* header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <category.Icon size={12} style={{ color: category.color }} />
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: category.color, textTransform: 'uppercase' }}>
          {category.label}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: C.muted, fontWeight: 500 }}>
          {timeAgo(alert.timestamp)}
        </span>
      </div>
      {/* title */}
      <h4 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{alert.supplier_name}</h4>
      {/* body */}
      <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{alert.alert_message}</p>
    </div>
  );
}
