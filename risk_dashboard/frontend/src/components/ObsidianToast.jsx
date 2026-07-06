import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  Info, 
  AlertTriangle, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  X, 
  RotateCcw,
  Sparkles,
  RefreshCw,
  Trash2,
  FileSpreadsheet,
  Plus
} from 'lucide-react';

// ==========================================
// 1. Color Palette and Configurations
// ==========================================

const STATUS_CONFIGS = {
  success: {
    color: '#34A853',
    bgLight: 'rgba(52, 168, 83, 0.1)',
    borderLight: 'rgba(52, 168, 83, 0.2)',
    shadow: '0 0 12px rgba(52, 168, 83, 0.15)',
    Icon: CheckCircle2,
  },
  info: {
    color: '#4285F4',
    bgLight: 'rgba(66, 133, 244, 0.1)',
    borderLight: 'rgba(66, 133, 244, 0.2)',
    shadow: '0 0 12px rgba(66, 133, 244, 0.15)',
    Icon: Info,
  },
  warning: {
    color: '#F59E0B',
    bgLight: 'rgba(245, 158, 11, 0.1)',
    borderLight: 'rgba(245, 158, 11, 0.2)',
    shadow: '0 0 12px rgba(245, 158, 11, 0.15)',
    Icon: AlertTriangle,
  },
  error: {
    color: '#D93025',
    bgLight: 'rgba(217, 48, 37, 0.1)',
    borderLight: 'rgba(217, 48, 37, 0.2)',
    shadow: '0 0 12px rgba(217, 48, 37, 0.15)',
    Icon: AlertCircle,
  }
};

// ==========================================
// 2. Individual Obsidian Toast Card Component
// ==========================================

export function ObsidianToastCard({ toast, onClose }) {
  const [expanded, setExpanded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(5000); // 5 seconds
  const timerRef = useRef(null);

  const config = STATUS_CONFIGS[toast.type] || STATUS_CONFIGS.info;
  const { color, bgLight, borderLight, shadow, Icon } = config;

  // Manage draining progress bar countdown
  useEffect(() => {
    if (paused || timeLeft <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 100) {
          clearInterval(timerRef.current);
          onClose();
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, timeLeft, onClose]);

  // Handle Pause/Resume Click
  const togglePause = (e) => {
    e.stopPropagation();
    setPaused(prev => !prev);
  };

  // Remaining seconds string
  const remainingSeconds = Math.ceil(timeLeft / 1000);

  return (
    <div
      className="toast-in flex flex-col w-[380px] bg-[#141313] rounded-lg overflow-hidden font-['Geist'] transition-all duration-300 border pointer-events-auto"
      style={{
        borderColor: color,
        boxShadow: shadow,
      }}
    >
      {/* Header Row */}
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Status Circle Icon */}
        <div 
          className="w-6 h-6 rounded-full flex items-center justify-center border shrink-0"
          style={{
            backgroundColor: bgLight,
            borderColor: borderLight,
          }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>

        {/* Bold Title */}
        <span className="flex-grow text-white text-sm font-bold tracking-tight select-none">
          {toast.title}
        </span>

        {/* Special Inline Undo for Supplier Removed Event */}
        {toast.hasUndo && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (toast.onUndo) toast.onUndo();
              onClose();
            }}
            className="px-2 py-0.5 text-xs font-bold text-[#4285F4] hover:text-white transition-colors bg-white/5 rounded border border-white/10 hover:bg-white/10 shrink-0 cursor-pointer"
          >
            Undo
          </button>
        )}

        {/* Actions (Chevron and Close X) */}
        <div className="flex items-center gap-2 text-white/40">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(prev => !prev);
            }}
            className="hover:text-white transition-colors p-0.5 cursor-pointer"
            aria-label={expanded ? "Collapse toast" : "Expand toast"}
          >
            <ChevronDown 
              className="w-4 h-4 transition-transform duration-200" 
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="hover:text-white transition-colors p-0.5 cursor-pointer"
            aria-label="Dismiss toast"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Content State */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <p className="text-white/70 text-sm leading-relaxed">
            {toast.desc}
          </p>
          {toast.action && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (toast.onAction) toast.onAction();
                onClose();
              }}
              className="self-start px-3 py-1.5 border border-white/20 rounded-md text-xs font-medium text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              {toast.action}
            </button>
          )}
        </div>
      )}

      {/* Footer/Progress Section */}
      <div className="bg-black/20 px-4 py-2 flex flex-col gap-1.5 border-t border-white/5">
        {/* Progress Bar Container */}
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
          {/* Draining Progress Bar */}
          <div 
            className="h-full w-full origin-left transition-all duration-100 ease-linear"
            style={{ 
              backgroundColor: color,
              width: `${(timeLeft / 5000) * 100}%`
            }}
          />
        </div>
        <div className="text-[11px] text-white/50 flex justify-between items-center select-none">
          <span>
            This message will close in {remainingSeconds} second{remainingSeconds !== 1 ? 's' : ''}.
          </span>
          <button 
            onClick={togglePause}
            className="font-bold hover:text-white transition-colors cursor-pointer text-[#4285F4] hover:underline bg-transparent border-none p-0"
          >
            {paused ? 'Resume' : 'Click to stop.'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. Obsidian Toast Provider and Context
// ==========================================

const TOAST_CATALOG = {
  supplierAdded: { title: 'Supplier added', desc: 'Successfully added to your monitored suppliers.', type: 'success' },
  supplierRestored: { title: 'Supplier restored', desc: 'Supplier is being monitored again.', type: 'success' },
  csvSuccess: { title: 'Suppliers imported', desc: 'Suppliers were successfully added to your monitored list.', type: 'success' },
  csvFail: { title: 'Import failed', desc: 'Something went wrong while importing suppliers. Please try again.', type: 'error' },
  scanStarted: { title: 'Scan initiated', desc: 'Updating risk data for suppliers. This may take a few moments.', type: 'info' },
  scanComplete: { title: 'Scan complete', desc: 'Risk data has been updated for suppliers.', type: 'success', action: 'View Results' },
  scanFail: { title: 'Scan failed', desc: 'We couldn\'t complete the risk scan. Please try again.', type: 'error' },
  supplierRemoved: { title: 'Supplier removed', desc: 'Supplier is no longer being monitored.', type: 'info', hasUndo: true },
  alert: { title: 'Security alert', desc: 'A supplier triggered a security alert.', type: 'error', action: 'View Alert' },
  riskChange: { title: 'High risk detected', desc: 'Supplier\'s risk level has changed to High.', type: 'warning', action: 'View Supplier' },
  simulated: { title: 'Event published', desc: 'A simulated event has been published to the system.', type: 'info' }
};

const ObsidianToastContext = createContext(null);

export function ObsidianToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  // Dismiss toast helper
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Display a toast using the specifications
  const triggerToast = useCallback((title, type = 'info', desc = '', options = {}) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    
    const newToast = {
      id,
      title,
      type, // 'success' | 'info' | 'warning' | 'error'
      desc,
      hasUndo: options.hasUndo || false,
      action: options.action || null,
      onUndo: options.onUndo || null,
      onAction: options.onAction || null,
    };

    // Newest toast stacked on top (at the beginning of the list)
    setToasts(prev => [newToast, ...prev]);
    return id;
  }, []);

  // Backwards compatible showToast matching original ToastContext API
  const showToast = useCallback((titleOrKey, descOrType = '', type = 'info', options = {}) => {
    const catalogConfig = TOAST_CATALOG[titleOrKey];
    
    let finalTitle = titleOrKey;
    let finalDesc = typeof descOrType === 'string' ? descOrType : '';
    let finalType = type;
    let finalAction = options.action || null;
    let finalHasUndo = options.hasUndo || false;

    if (catalogConfig) {
      finalTitle = catalogConfig.title;
      finalDesc = (typeof descOrType === 'string' && descOrType) ? descOrType : catalogConfig.desc;
      finalType = catalogConfig.type;
      finalAction = catalogConfig.action || options.action || null;
      finalHasUndo = catalogConfig.hasUndo || options.hasUndo || false;
    }

    return triggerToast(finalTitle, finalType, finalDesc, {
      hasUndo: finalHasUndo,
      action: finalAction,
      onUndo: options.onUndo,
      onAction: options.onAction
    });
  }, [triggerToast]);

  return (
    <ObsidianToastContext.Provider value={{ triggerToast, showToast, removeToast, toasts }}>
      {children}

      {/* Stack container at bottom-right */}
      <div
        className="fixed bottom-24 right-6 flex flex-col gap-3 z-[9999] pointer-events-none"
        style={{
          maxHeight: 'calc(100vh - 120px)',
          overflowY: 'auto',
          paddingRight: '4px',
        }}
      >
        {toasts.map(toast => (
          <ObsidianToastCard 
            key={toast.id} 
            toast={toast} 
            onClose={() => removeToast(toast.id)} 
          />
        ))}
      </div>
    </ObsidianToastContext.Provider>
  );
}

export function useObsidianToast() {
  const context = useContext(ObsidianToastContext);
  if (!context) {
    throw new Error('useObsidianToast must be used within an ObsidianToastProvider');
  }
  return context;
}

export function useToast() {
  return useObsidianToast();
}

// ==========================================
// 4. Interactive Demo Panel Component
// ==========================================

export function ObsidianToastDemo() {
  const { triggerToast } = useObsidianToast();
  const [scanStatus, setScanStatus] = useState('idle'); // idle | scanning
  const [suppliers, setSuppliers] = useState([
    { id: 1, name: 'Apex Logistics', risk: 'LOW' },
    { id: 2, name: 'Titanium Foundries', risk: 'MEDIUM' },
    { id: 3, name: 'SinoTech Suppliers', risk: 'HIGH' }
  ]);

  // Simulation handlers matching the catalog events
  const triggerSupplierAdded = () => {
    triggerToast(
      'Supplier added',
      'success',
      'Apex Logistics has been added to your monitored suppliers.'
    );
  };

  const triggerCsvImportSuccess = () => {
    triggerToast(
      'Suppliers imported',
      'success',
      '12 suppliers were successfully added to your monitored list.'
    );
  };

  const triggerCsvImportFail = () => {
    triggerToast(
      'Import failed',
      'error',
      'Something went wrong while importing suppliers. Please try again.'
    );
  };

  // Handles Scan flow with badge updates and loader simulation
  const startScan = () => {
    setScanStatus('scanning');
    
    // Toast 4: Scan Initiated
    triggerToast(
      'Scan initiated',
      'info',
      'Updating risk data for 3 suppliers. This may take a few moments.'
    );

    // Simulate complete or fail
    setTimeout(() => {
      const isSuccess = Math.random() > 0.15;
      setScanStatus('idle');
      
      if (isSuccess) {
        // Toast 5: Scan Complete
        triggerToast(
          'Scan complete',
          'success',
          'Risk data has been updated for 3 suppliers.',
          {
            action: 'View Results',
            onAction: () => alert('Navigating to Risk Intelligence tab!')
          }
        );
      } else {
        // Toast 6: Scan Failed
        triggerToast(
          'Scan failed',
          'error',
          "We couldn't complete the risk scan. Please try again."
        );
      }
    }, 4000);
  };

  const triggerSupplierRemoved = () => {
    const targetSupplier = 'SinoTech Suppliers';
    triggerToast(
      'Supplier removed',
      'info',
      `${targetSupplier} is no longer being monitored.`,
      {
        hasUndo: true,
        onUndo: () => {
          // Immediately show success toast
          triggerToast(
            'Supplier restored',
            'success',
            `${targetSupplier} is being monitored again.`
          );
        }
      }
    );
  };

  const triggerSecurityAlert = () => {
    triggerToast(
      'Security alert',
      'error',
      'Titanium Foundries triggered a security alert: Unauthorized credentials detected in firmware logs.',
      {
        action: 'View Alert',
        onAction: () => alert('Scrolling to Titanium Foundries Alert details...')
      }
    );
  };

  const triggerHighRiskDetected = () => {
    triggerToast(
      'High risk detected',
      'warning',
      "SinoTech Suppliers's risk level has changed to High.",
      {
        action: 'View Supplier',
        onAction: () => alert('Navigating and highlighting SinoTech Suppliers card!')
      }
    );
  };

  const triggerEventPublished = () => {
    triggerToast(
      'Event published',
      'info',
      'A simulated event has been published to the system.'
    );
  };

  return (
    <div className="p-6 bg-[#0a0a0a] rounded-xl border border-white/10 max-w-4xl mx-auto my-8 text-white font-['Geist'] shadow-2xl">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
        <Sparkles className="text-[#4285F4] w-6 h-6 animate-pulse" />
        <div>
          <h2 className="text-xl font-bold tracking-tight">Obsidian Deep Toast Playground</h2>
          <p className="text-xs text-white/50">Test and preview the 10 custom notification events with dynamic behaviors.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Event Controllers */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/40">Trigger App Events</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button 
              onClick={triggerSupplierAdded}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-md text-xs font-semibold text-left transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#34A853]" />
              <span>1. Supplier Added</span>
            </button>

            <button 
              onClick={triggerCsvImportSuccess}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-md text-xs font-semibold text-left transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#34A853]" />
              <span>2. CSV Import Success</span>
            </button>

            <button 
              onClick={triggerCsvImportFail}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-md text-xs font-semibold text-left transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#D93025]" />
              <span>3. CSV Import Fail</span>
            </button>

            <button 
              onClick={startScan}
              disabled={scanStatus === 'scanning'}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-md text-xs font-semibold text-left transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#4285F4] ${scanStatus === 'scanning' ? 'animate-spin' : ''}`} />
              <span>4/5/6. Run Risk Scan</span>
            </button>

            <button 
              onClick={triggerSupplierRemoved}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-md text-xs font-semibold text-left transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-[#4285F4]" />
              <span>7. Supplier Removed (Undo)</span>
            </button>

            <button 
              onClick={triggerSecurityAlert}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-md text-xs font-semibold text-left transition-colors cursor-pointer"
            >
              <AlertCircle className="w-3.5 h-3.5 text-[#D93025]" />
              <span>8. Security Alert</span>
            </button>

            <button 
              onClick={triggerHighRiskDetected}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-md text-xs font-semibold text-left transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>9. High Risk Detected</span>
            </button>

            <button 
              onClick={triggerEventPublished}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-md text-xs font-semibold text-left transition-colors cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-[#4285F4]" />
              <span>10. Event Published</span>
            </button>
          </div>
        </div>

        {/* Live Simulation Indicators */}
        <div className="bg-[#121212] border border-white/10 rounded-lg p-4 flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/40">Dashboard Status Simulation</h3>
          
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-xs text-white/70">Scan Trigger Button State:</span>
            <button 
              onClick={startScan}
              disabled={scanStatus === 'scanning'}
              className="px-3 py-1 bg-[#232222] border border-white/10 rounded text-xs hover:bg-white/5 transition-colors flex items-center gap-2 disabled:opacity-75 disabled:hover:bg-[#232222] cursor-pointer"
            >
              {scanStatus === 'scanning' ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin text-[#4285F4]" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3 text-[#4285F4]" />
                  <span>Scan Now</span>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-white/70">Risk Level Badges (Switches to PENDING on scan):</span>
            <div className="flex flex-col gap-1.5">
              {suppliers.map(s => (
                <div key={s.id} className="flex justify-between items-center bg-black/30 px-3 py-1.5 rounded border border-white/5">
                  <span className="text-xs font-medium text-white/90">{s.name}</span>
                  {scanStatus === 'scanning' ? (
                    <span className="text-[10px] font-bold text-white/50 bg-white/5 px-2 py-0.5 rounded border border-white/10 animate-pulse">PENDING</span>
                  ) : (
                    <span 
                      className="text-[10px] font-bold px-2 py-0.5 rounded border"
                      style={{
                        backgroundColor: s.risk === 'HIGH' ? 'rgba(239,68,68,.1)' : s.risk === 'MEDIUM' ? 'rgba(245,158,11,.1)' : 'rgba(34,197,94,.1)',
                        borderColor: s.risk === 'HIGH' ? 'rgba(239,68,68,.25)' : s.risk === 'MEDIUM' ? 'rgba(245,158,11,.25)' : 'rgba(34,197,94,.25)',
                        color: s.risk === 'HIGH' ? '#ef4444' : s.risk === 'MEDIUM' ? '#f59e0b' : '#4ade80',
                      }}
                    >
                      {s.risk}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
