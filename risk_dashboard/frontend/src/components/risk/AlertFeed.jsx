import React, { useState, useRef } from 'react';
import AlertCard from './AlertCard';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function AlertFeed({ data=[], loading }) {
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

  const visibleItems = expanded ? data : data.slice(0, 3);

  const skeletonItems = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 16px 0 16px' }}>
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
          {/* Header Row Skeleton */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div className="skeleton" style={{ height: 12, width: 12, borderRadius: '50%', flexShrink: 0 }} />
            <div className="skeleton" style={{ height: 8, width: 100, borderRadius: 4 }} />
            <div className="skeleton" style={{ marginLeft: 'auto', height: 8, width: 50, borderRadius: 4 }} />
          </div>
          {/* Title Skeleton */}
          <div className="skeleton" style={{ height: 14, width: '50%', borderRadius: 4, marginBottom: 8 }} />
          {/* Body Skeleton */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="skeleton" style={{ height: 10, width: '100%', borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 10, width: '80%', borderRadius: 4 }} />
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
            padding: '16px 16px 0 16px'
          }}
        >
          {loading
            ? skeletonItems
            : visibleItems.map(item => (
                <AlertCard key={item.timestamp + item.supplier_name} alert={item} interactive={true} />
              ))
          }
          {!loading && data.length === 0 && (
            <div style={{
              padding: '40px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px'
            }}>
              No alerts yet.
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

      {/* Button — pinned at bottom, always inside card, both states */}
      {!loading && data.length > 3 && (
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
              : <><ChevronDown size={14} /> View all {data.length} alerts</>
            }
          </button>
        </div>
      )}

    </div>
  );
}
