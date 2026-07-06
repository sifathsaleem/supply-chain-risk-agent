import React, { useState, useRef } from 'react';
import SupplierRiskCard from './SupplierRiskCard';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function RiskScoreboard({ data=[], loading }) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  React.useEffect(() => {
    if (containerRef.current) {
      const parent = containerRef.current.parentElement;
      if (parent) {
        parent.style.padding = '0px';
        parent.style.overflow = 'hidden';
      }
    }
  }, []);

  function handleShowLess() {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
    setExpanded(false);
  }

  const sorted = [...data].sort((a,b)=>{
    const o = {HIGH:0,CRITICAL:0,MEDIUM:1,LOW:2};
    return (o[a.risk_level?.toUpperCase()]??3)-(o[b.risk_level?.toUpperCase()]??3);
  });

  const visibleItems = expanded ? sorted : sorted.slice(0, 3);

  const skeletonItems = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3].map(i => (
        <div
          key={i}
          style={{
            padding: 16,
            borderRadius: 8,
            background: '#1c1b1b',
            border: '1px solid #2d2c2c',
          }}
        >
          {/* Header Skeleton */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 14, width: '60%', borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 10, width: '30%', borderRadius: 4 }} />
            </div>
            <div className="skeleton" style={{ height: 18, width: 50, borderRadius: 4, flexShrink: 0 }} />
          </div>
          {/* Progress Bar Skeleton */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="skeleton" style={{ height: 8, width: 80, borderRadius: 4 }} />
              <div className="skeleton" style={{ height: 8, width: 90, borderRadius: 4 }} />
            </div>
            <div className="skeleton" style={{ height: 6, width: '100%', borderRadius: 99 }} />
          </div>
          {/* Footer Skeleton */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <div className="skeleton" style={{ height: 14, width: 14, borderRadius: '50%', flexShrink: 0 }} />
              <div className="skeleton" style={{ height: 10, width: '70%', borderRadius: 4 }} />
            </div>
            <div className="skeleton" style={{ height: 8, width: 50, borderRadius: 4, flexShrink: 0, marginLeft: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div 
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        borderRadius: '0 0 12px 12px',
        background: 'var(--bg-card)'
      }}
    >

      {/* Wrapper with relative positioning to contain the gradient */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Content area — scrollable only when expanded */}
        <div
          ref={contentRef}
          className="scrollable"
          style={{
            flex: 1,
            overflowY: 'auto',
            scrollbarGutter: 'stable',
            padding: '16px 16px 0 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}
        >
          {loading
            ? skeletonItems
            : visibleItems.map(item => (
                <SupplierRiskCard key={item.supplier_name} supplier={item} interactive={true} />
              ))
          }
          {!loading && sorted.length === 0 && (
            <div style={{
              padding: '40px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px'
            }}>
              No risk data yet. Add suppliers and run a scan.
            </div>
          )}
        </div>

        {/* Gradient overlay — only when collapsed AND has more items */}
        {!loading && !expanded && sorted.length > 3 && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '80px',
            background: 'linear-gradient(to bottom, transparent, #111118)',
            pointerEvents: 'none'
          }} />
        )}

      </div>

      {/* Button — pinned at bottom, always inside card, both states */}
      {!loading && sorted.length > 3 && (
        <div style={{
          flexShrink: 0,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'var(--bg-card)'
        }}>
          <button
            onClick={() => expanded ? handleShowLess() : setExpanded(true)}
            onMouseEnter={e =>
              e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e =>
              e.currentTarget.style.color = 'var(--text-secondary)'}
            style={{
              width: '100%',
              padding: '12px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontFamily: 'inherit',
              transition: 'color 0.15s ease'
            }}
          >
            {expanded
              ? <><ChevronUp size={14} /> Show less</>
              : <><ChevronDown size={14} /> View all {sorted.length} suppliers</>
            }
          </button>
        </div>
      )}

    </div>
  );
}
