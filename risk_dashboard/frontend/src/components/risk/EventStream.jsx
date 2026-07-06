import React, { useState, useRef } from 'react';
import { timeAgo } from '../../utils';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';

const C = {
  scHigh: '#2d2c2c',
  outline: '#2d2c2c',
  muted:   '#a1a1a1',
};

function getEventCategory(event) {
  if (event.security_flag) {
    return { label: 'SECURITY', color: '#f97316' };
  }
  const text = (event.raw_text_preview || '').toLowerCase();
  if (text.includes('flood') || text.includes('fire') ||
      text.includes('earthquake') || text.includes('factory') ||
      text.includes('production') || text.includes('shutdown')) {
    return { label: 'OPERATIONAL', color: '#f97316' };
  }
  if (text.includes('strike') || text.includes('protest') ||
      text.includes('political') || text.includes('unrest')) {
    return { label: 'GEOPOLITICAL', color: '#3b82f6' };
  }
  if (text.includes('bankrupt') || text.includes('financial') ||
      text.includes('credit') || text.includes('revenue')) {
    return { label: 'FINANCIAL', color: '#f59e0b' };
  }
  if (text.includes('port') || text.includes('shipping') ||
      text.includes('logistics') || text.includes('freight') ||
      text.includes('supply chain') || text.includes('semiconductor')) {
    return { label: 'LOGISTICS', color: '#8b5cf6' };
  }
  return { label: 'SUPPLY CHAIN', color: '#64748b' };
}

function hexToRgba(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export default function EventStream({ data = [], loading }) {
  const [expanded, setExpanded] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
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

  const visibleEvents = expanded ? data : data.slice(0, 3);

  const skeletonRows = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ padding: '16px 20px', borderBottom: `1px solid ${C.outline}` }}>
          {/* Header Skeleton */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
              <div className="skeleton" style={{ height: 12, width: '60%', borderRadius: 4 }} />
            </div>
            <div className="skeleton" style={{ height: 8, width: 50, borderRadius: 4, flexShrink: 0 }} />
          </div>
          {/* Article Count Skeleton */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, paddingLeft: 18 }}>
            <div className="skeleton" style={{ height: 10, width: 10, borderRadius: 2 }} />
            <div className="skeleton" style={{ height: 8, width: 90, borderRadius: 4 }} />
          </div>
          {/* Body text Skeleton */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 18, marginBottom: 12 }}>
            <div className="skeleton" style={{ height: 10, width: '100%', borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 10, width: '70%', borderRadius: 4 }} />
          </div>
          {/* Tag Skeleton */}
          <div style={{ paddingLeft: 18 }}>
            <div className="skeleton" style={{ height: 14, width: 70, borderRadius: 3 }} />
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

        {/* Scrollable items area */}
        <div 
          ref={contentRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            scrollbarGutter: 'stable'
          }} 
          className="scrollable"
        >
          {loading
            ? skeletonRows
            : visibleEvents.map((ev, i) => {
                const category = getEventCategory(ev);
                const label = category.label;
                const labelColor = category.color;
                const labelBg = hexToRgba(category.color, 0.15);
                const location = ev.country ? `${ev.supplier_name} • ${ev.country.toUpperCase()}` : ev.supplier_name;

                return (
                  <div key={i}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    style={{
                      padding: '16px 20px',
                      borderBottom: `1px solid ${C.outline}`,
                      cursor: 'pointer',
                      background: hoveredIndex === i
                        ? 'rgba(255,255,255,0.03)'
                        : 'transparent',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    {/* Line 1: Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: ev.security_flag
                            ? '#ef4444'
                            : '#22c55e',
                          flexShrink: 0,
                          marginTop: '5px'
                        }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{location}</span>
                      </div>
                      <span style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                        whiteSpace: 'nowrap'
                      }}>
                        {timeAgo(ev.timestamp)}
                      </span>
                    </div>

                    {/* Fix 7: Article Count (Line 1.5) */}
                    {!ev.security_flag && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                        marginBottom: '6px',
                        paddingLeft: 16
                      }}>
                        <FileText size={10} />
                        <span>
                          {ev.article_count || 1} article
                          {(ev.article_count || 1) !== 1 ? 's' : ''} analyzed
                        </span>
                      </div>
                    )}
 
                    {/* Line 2: Body text */}
                    <p style={{
                      fontSize: 12,
                      color: C.muted,
                      lineHeight: 1.5,
                      paddingLeft: 16,
                      marginBottom: 8,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {ev.security_flag ? 'Blocked prompt injection attempt.' : (ev.raw_text_preview || ev.alert_message)}
                    </p>

                    {/* Line 3: Category tag */}
                    <div style={{ paddingLeft: 16 }}>
                      <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 6px', borderRadius: 3, color: labelColor, background: labelBg }}>
                        {label}
                      </span>
                    </div>
                  </div>
                );
              })
          }
          {!loading && data.length === 0 && (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No events yet.
            </div>
          )}
        </div>

        {/* Gradient overlay — only when collapsed AND has more items */}
        {!loading && !expanded && data.length > 3 && (
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

      {/* Sticky bottom button */}
      {!loading && data.length > 3 && (
        <div style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => expanded ? handleShowLess() : setExpanded(true)}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
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
            }}>
            {expanded
              ? <><ChevronUp size={14} /> Show less</>
              : <><ChevronDown size={14} /> View all {data.length} events</>
            }
          </button>
        </div>
      )}

    </div>
  );
}
