import React from 'react';
import TopBar from './TopBar';
import RiskScoreboard from './RiskScoreboard';
import AlertFeed from './AlertFeed';
import EventStream from './EventStream';
import { useToast } from '../../context/ToastContext';

const C = {
  bg:      '#0e0e0e',
  sc:      '#232222',
  outline: '#2d2c2c',
};

export default function RiskTab({ riskScoresState, alertsState, eventsState, refreshInterval }) {
  const { showToast } = useToast();
  const { data: riskScores, loading: scoresLoading, lastFetched, refetch: refetchScores } = riskScoresState;
  const { data: alerts, loading: alertsLoading, refetch: refetchAlerts } = alertsState;
  const { data: events, loading: eventsLoading, refetch: refetchEvents } = eventsState;

  const handleSimulate = async () => {
    try {
      const res = await fetch('/api/simulate', { method:'POST' });
      const data = await res.json();
      if (data.warning) {
        showToast('Simulation Triggered', 'Posted with warning: ' + data.warning, 'warning');
      } else {
        showToast('simulated', '⚡ High risk event published to Pub/Sub!');
      }
      setTimeout(async () => { await refetchScores(); await refetchAlerts(); await refetchEvents(); }, 1500);
    } catch(e) { showToast('Simulation Failed', e.message, 'error'); }
  };

  const panel = {
    background: C.sc,
    border: `1px solid ${C.outline}`,
    borderRadius: 12,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    maxHeight: 'calc(100vh - 340px)',
    minHeight: 500,
  };
  const panelHead = {
    padding:'14px 16px',
    borderBottom:`1px solid ${C.outline}`,
    background:'rgba(45,44,44,0.4)',
    display:'flex', alignItems:'center', justifyContent:'space-between',
    flexShrink:0,
  };

  return (
    <div style={{
      width:'100%', maxWidth:1600, margin:'0 auto',
      padding:'32px 24px 56px',
      display:'flex', flexDirection:'column', gap:24,
      background:'#0e0e0e', minHeight:'100vh',
    }}>
      <TopBar riskScores={riskScores} onSimulate={handleSimulate} lastFetched={lastFetched} refreshInterval={refreshInterval} />

      {/* Three-column panels */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}}>

        {/* Panel 1: Supplier Risk Status */}
        <div style={panel}>
          <div style={panelHead}>
            <h2 style={{fontSize:14,fontWeight:600,color:'#fff'}}>Supplier Risk Status</h2>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:16,display:'flex',flexDirection:'column',gap:12}}>
            <RiskScoreboard data={riskScores} loading={scoresLoading} />
          </div>
        </div>

        {/* Panel 2: Manager Alerts */}
        <div style={panel}>
          <div style={panelHead}>
            <h2 style={{fontSize:14,fontWeight:600,color:'#fff'}}>Manager Alerts</h2>
            {!alertsLoading && alerts.length>0 && (
              <span style={{
                fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',
                padding:'3px 8px',borderRadius:999,
                background:'#ef4444',color:'#000',
              }}>{alerts.length} New</span>
            )}
          </div>
          <div style={{flex:1,overflowY:'auto',padding:16}}>
            <AlertFeed data={alerts} loading={alertsLoading} />
          </div>
        </div>

        {/* Panel 3: Live Event Stream */}
        <div style={panel}>
          <div style={panelHead}>
            <h2 style={{fontSize:14,fontWeight:600,color:'#fff'}}>Live Event Stream</h2>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:'#ef4444',animation:'ping 1s cubic-bezier(0,0,.2,1) infinite'}} className="ping" />
              <span style={{fontSize:10,fontWeight:700,letterSpacing:'0.08em',color:'#fff'}}>LIVE</span>
            </div>
          </div>
          <div style={{flex:1,overflowY:'auto'}}>
            <EventStream data={events} loading={eventsLoading} />
          </div>
        </div>
      </div>
    </div>
  );
}
