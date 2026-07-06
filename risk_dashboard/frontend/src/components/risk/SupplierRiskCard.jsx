import React, { useState } from 'react';
import { timeAgo } from '../../utils';

const C = {
  scLow:     '#1c1b1b',
  scHigh:    '#2d2c2c',
  outline:   '#2d2c2c',
  muted:     '#a1a1a1',
};

const levelStyle = (l) => {
  if (l==='HIGH'||l==='CRITICAL') return { bg:'rgba(239,68,68,.10)', color:'#ef4444', border:'rgba(239,68,68,.25)', barColor:'#ef4444', sentColor:'#ef4444', sentIcon:'sentiment_dissatisfied' };
  if (l==='MEDIUM')               return { bg:'rgba(245,158,11,.10)', color:'#f59e0b', border:'rgba(245,158,11,.25)', barColor:'#f59e0b', sentColor:'#f59e0b', sentIcon:'schedule' };
  if (l==='SECURITY')             return { bg:'rgba(239,68,68,.10)', color:'#ef4444', border:'rgba(239,68,68,.25)', barColor:'#ef4444', sentColor:'#ef4444', sentIcon:'security' };
  if (l==='LOW')                  return { bg:'rgba(34,197,94,.10)',  color:'#4ade80', border:'rgba(34,197,94,.25)',  barColor:'#4ade80', sentColor:'#4ade80', sentIcon:'sentiment_satisfied' };
  return { bg:'rgba(255,255,255,.06)', color:'#a1a1a1', border:'rgba(255,255,255,.12)', barColor:'#a1a1a1', sentColor:'#a1a1a1', sentIcon:'visibility' };
};

export default function SupplierRiskCard({ supplier, interactive }) {
  console.log('supplier fields:', supplier);
  const [hovered, setHovered] = useState(false);
  const level = supplier.risk_level?.toUpperCase() || 'LOW';
  const style = levelStyle(level);
  const confidencePct = supplier.confidence ? Math.round(supplier.confidence * 100) : 0;
  const score = supplier.risk_score ?? 0;

  // Short action text — strip long context
  const action = (supplier.recommended_action || 'Monitor closely')
    .split(/\.\s+Context:|\.\s+Based on/i)[0]
    .slice(0, 55)
    .trim();

  return (
    <div
      onMouseEnter={() => interactive && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: 16, borderRadius: 8,
        background: hovered && interactive ? C.scHigh : C.scLow,
        border: `1px solid ${C.outline}`,
        transition: 'background 0.15s ease',
        cursor: 'default',
      }}
    >
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
        <div>
          <h3 style={{fontSize:13,fontWeight:700,color:'#fff',lineHeight:'18px'}}>{supplier.supplier_name}</h3>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
            {supplier.country}
            {supplier.category && supplier.category !== 'Unknown'
              ? ` · ${supplier.category}`
              : ''
            }
          </div>
        </div>
        <span style={{
          fontSize:9,fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',
          padding:'3px 7px',borderRadius:4,
          background:style.bg, color:style.color, border:`1px solid ${style.border}`,
          flexShrink:0,
        }}>{level}</span>
      </div>

      {/* Risk score bar */}
      <div style={{marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:10,fontWeight:700,color:C.muted,letterSpacing:'0.05em',marginBottom:6,textTransform:'uppercase'}}>
          <span>RISK SCORE: {score}</span>
          <span>CONFIDENCE: {confidencePct}%</span>
        </div>
        <div style={{width:'100%',height:6,background:'#0e0e0e',borderRadius:99,overflow:'hidden'}}>
          <div style={{height:'100%',width:`${Math.min(score,100)}%`,background:style.barColor,borderRadius:99,transition:'width .5s ease'}} />
        </div>
      </div>


      {/* Footer: sentiment icon + action text + time */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <span className="material-symbols-outlined" style={{fontSize:16,color:style.sentColor,flexShrink:0}}>{style.sentIcon}</span>
          <span style={{fontSize:11,color:C.muted}}>{action}</span>
        </div>
        <span style={{fontSize:10,color:C.muted,flexShrink:0,marginLeft:8}}>{timeAgo(supplier.last_updated)}</span>
      </div>
    </div>
  );
}
