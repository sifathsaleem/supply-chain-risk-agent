import React from 'react';
import AlertCard from './AlertCard';
import { BellOff } from 'lucide-react';

export default function AlertFeed({ data = [], loading }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="card p-4 flex flex-col gap-2 min-h-[100px]">
            <div className="flex justify-between items-center">
              <div className="skeleton h-5 w-28"></div>
              <div className="skeleton h-5 w-16"></div>
            </div>
            <div className="skeleton h-3.5 w-20 mt-1"></div>
            <div className="skeleton h-4 w-full mt-2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 text-center py-12 text-text-secondary">
        <BellOff className="size-8 text-text-muted" />
        <p className="text-sm font-medium">No alerts yet.</p>
        <p className="text-xs text-text-muted">High or Medium risk events will generate alerts here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {data.map((alert, idx) => (
        <AlertCard key={idx} alert={alert} />
      ))}
    </div>
  );
}
