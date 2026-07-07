import { useState }        from 'react';
import { ToastProvider }   from './context/ToastContext';
import TabNav              from './components/TabNav';
import SupplierTab         from './components/suppliers/SupplierTab';
import RiskTab             from './components/risk/RiskTab';
import { useSuppliers }    from './hooks/useSuppliers';
import { useRiskScores }   from './hooks/useRiskScores';
import { useAlerts }       from './hooks/useAlerts';
import { useEvents }       from './hooks/useEvents';
import './index.css';

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem('dashboard_active_tab') || 'suppliers';
    } catch {
      return 'suppliers';
    }
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('dashboard_active_tab', tab);
    } catch (e) {
      console.error(e);
    }
  };

  const [refreshInterval, setRefreshInterval] = useState(30000); // Default to 30s

  // Load all data at the App root level so it stays mounted and doesn't re-fetch on tab switch
  const suppliersState = useSuppliers();
  const riskScoresState = useRiskScores(refreshInterval);
  const alertsState = useAlerts(refreshInterval);
  const eventsState = useEvents(refreshInterval);

  return (
    <ToastProvider>
      <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', backgroundColor:'#0a0a0a' }}>
        <TabNav 
          activeTab={activeTab} 
          onTabChange={handleTabChange} 
          alerts={alertsState.data}
          refreshInterval={refreshInterval}
          onIntervalChange={setRefreshInterval}
        />
        {/* 56px top offset for fixed nav, 32px bottom for footer */}
        <div style={{ flex:1, overflow:'auto', paddingTop:56, paddingBottom:32 }}>
          <div style={{ display: activeTab === 'suppliers' ? 'block' : 'none' }}>
            <SupplierTab 
              suppliersState={suppliersState} 
              riskScoresState={riskScoresState} 
            />
          </div>
          <div style={{ display: activeTab === 'risk' ? 'block' : 'none' }}>
            <RiskTab 
              riskScoresState={riskScoresState} 
              alertsState={alertsState} 
              eventsState={eventsState} 
              refreshInterval={refreshInterval}
            />
          </div>
        </div>
        {/* Status bar — matches mockup footer */}
        <footer style={{
          position:'fixed',bottom:0,left:0,right:0,height:32,
          background:'#1c1b1b',borderTop:'1px solid #2d2c2c',
          display:'flex',alignItems:'center',justifyContent:'space-between',
          padding:'0 24px',zIndex:100,
        }}>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:'#4ade80',display:'inline-block'}} />
              <span style={{fontSize:10,fontWeight:700,letterSpacing:'0.08em',color:'#a1a1a1',textTransform:'uppercase'}}>Systems Operational</span>
            </div>
            <div style={{width:1,height:12,background:'#2d2c2c'}} />
            <span style={{fontSize:10,color:'#a1a1a1'}}>Global Sync: 100%</span>
          </div>
        </footer>
      </div>
    </ToastProvider>
  );
}
