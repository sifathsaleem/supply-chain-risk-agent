import React from 'react';
import { timeAgo, getRiskColor } from '../../utils';
import { Radio } from 'lucide-react';

export default function EventStream({ data = [], loading }) {
  if (loading) {
    return (
      <div className="flex flex-col">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex gap-3 p-3 border-b border-[rgba(255,255,255,0.04)] items-start">
            <div className="skeleton size-2 rounded-full mt-1.5"></div>
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="skeleton h-4 w-32"></div>
              <div className="skeleton h-3 w-16"></div>
              <div className="skeleton h-3.5 w-full mt-1"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 text-center py-12 text-text-secondary">
        <Radio className="size-8 text-text-muted animate-pulse" />
        <p className="text-sm font-medium">No events yet.</p>
        <p className="text-xs text-text-muted">News events will appear in this feed once scans run.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {data.map((ev, idx) => {
        const dotColor = ev.security_flag ? 'var(--risk-high)' : 'var(--risk-low)';

        return (
          <div
            key={idx}
            className="px-4 py-3.5 border-b border-[rgba(255,255,255,0.05)] last:border-0 flex items-start gap-3 hover:bg-[rgba(255,255,255,0.01)] transition-colors"
          >
            {/* Left dot */}
            <div
              className="size-2 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: dotColor }}
            ></div>

            {/* Center column */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="font-semibold text-xs text-text-primary">{ev.supplier_name}</span>
                {ev.country && (
                  <span className="text-[11px] text-text-secondary">&middot; {ev.country}</span>
                )}
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">
                {timeAgo(ev.timestamp)}
              </div>
              <div className="text-xs text-text-secondary leading-relaxed mt-1.5 break-words">
                {ev.raw_text_preview}
              </div>
            </div>

            {/* Right column */}
            {ev.security_flag && (
              <span className="badge badge-security shrink-0">SECURITY</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
