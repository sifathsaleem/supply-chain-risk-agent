import React from 'react';
import TopBar from './TopBar';
import RiskScoreboard from './RiskScoreboard';
import AlertFeed from './AlertFeed';
import EventStream from './EventStream';
import { useToast } from '../../context/ToastContext';

export default function RiskTab({ riskScoresState, alertsState, eventsState }) {
  const { showToast } = useToast();
  const { data: riskScores, loading: scoresLoading, lastFetched, refetch: refetchScores } = riskScoresState;
  const { data: alerts, loading: alertsLoading, refetch: refetchAlerts } = alertsState;
  const { data: events, loading: eventsLoading, refetch: refetchEvents } = eventsState;

  const handleSimulate = async () => {
    try {
      const res = await fetch('/api/simulate', { method: 'POST' });
      const data = await res.json();
      if (data.warning) {
        showToast('Simulation posted with warning: ' + data.warning, 'info');
      } else {
        showToast('⚡ Simulated HIGH risk event published to Pub/Sub!', 'info');
      }
      // Trigger a quick reload of scoreboard & alerts after publishing simulation
      setTimeout(async () => {
        await refetchScores();
        await refetchAlerts();
        await refetchEvents();
      }, 1500);
    } catch (err) {
      showToast('Simulation trigger failed: ' + err.message, 'error');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <TopBar
        riskScores={riskScores}
        onSimulate={handleSimulate}
        lastFetched={lastFetched}
      />
      
      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-4 p-4 min-h-0">
        {/* Panel 1: Live Risk Scoreboard */}
        <div className="card flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-card)] flex justify-between items-center shrink-0">
            <h2 className="text-xs font-semibold text-text-primary tracking-wide">⚡ Live Risk Scoreboard</h2>
            {riskScores.length > 0 && (
              <span className="text-[10px] text-text-muted">{riskScores.length} monitored</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto scrollable p-3">
            <RiskScoreboard data={riskScores} loading={scoresLoading} />
          </div>
        </div>

        {/* Panel 2: Manager Alerts */}
        <div className="card flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-card)] flex justify-between items-center shrink-0">
            <h2 className="text-xs font-semibold text-text-primary tracking-wide">🔔 Manager Alerts</h2>
            {alerts.length > 0 && (
              <span className="text-[10px] text-text-muted">Latest {alerts.length}</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto scrollable p-3">
            <AlertFeed data={alerts} loading={alertsLoading} />
          </div>
        </div>

        {/* Panel 3: Live Event Stream */}
        <div className="card flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-card)] flex justify-between items-center shrink-0">
            <h2 className="text-xs font-semibold text-text-primary tracking-wide">📡 Live Event Stream</h2>
            {events.length > 0 && (
              <span className="text-[10px] text-text-muted">Last {events.length}</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto scrollable p-0">
            <EventStream data={events} loading={eventsLoading} />
          </div>
        </div>
      </div>
    </div>
  );
}
