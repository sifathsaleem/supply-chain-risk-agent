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
  const [activeTab, setActiveTab] = useState('suppliers');

  // Load all data at the App root level so it stays mounted and doesn't re-fetch on tab switch
  const suppliersState = useSuppliers();
  const riskScoresState = useRiskScores();
  const alertsState = useAlerts();
  const eventsState = useEvents();

  return (
    <ToastProvider>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {activeTab === 'suppliers' ? (
            <SupplierTab 
              suppliersState={suppliersState} 
              riskScoresState={riskScoresState} 
            />
          ) : (
            <RiskTab 
              riskScoresState={riskScoresState} 
              alertsState={alertsState} 
              eventsState={eventsState} 
            />
          )}
        </div>
      </div>
    </ToastProvider>
  );
}
