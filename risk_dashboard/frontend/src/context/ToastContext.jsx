import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';

const ToastContext = createContext(null);

const STATUS_CONFIGS = {
  success: {
    color: '#34A853',
    bgLight: 'rgba(52, 168, 83, 0.1)',
    borderLight: 'rgba(52, 168, 83, 0.2)',
    shadow: 'none',
    Icon: CheckCircle2,
  },
  info: {
    color: '#4285F4',
    bgLight: 'rgba(66, 133, 244, 0.1)',
    borderLight: 'rgba(66, 133, 244, 0.2)',
    shadow: 'none',
    Icon: Info,
  },
  warning: {
    color: '#F59E0B',
    bgLight: 'rgba(245, 158, 11, 0.1)',
    borderLight: 'rgba(245, 158, 11, 0.2)',
    shadow: 'none',
    Icon: AlertTriangle,
  },
  error: {
    color: '#D93025',
    bgLight: 'rgba(217, 48, 37, 0.1)',
    borderLight: 'rgba(217, 48, 37, 0.2)',
    shadow: 'none',
    Icon: AlertCircle,
  }
};

const TOAST_CATALOG = {
  supplierAdded: { title: 'Supplier added', desc: '{Name} has been added to your monitored suppliers.', type: 'success' },
  suppliersImported: { title: 'Suppliers imported', desc: '{N} suppliers were successfully added to your monitored list.', type: 'success' },
  importFailed: { title: 'Import failed', desc: 'Something went wrong while importing suppliers. Please try again.', type: 'error' },
  failedToAdd: { title: 'Failed to add {Name}', desc: 'Could not save this supplier. Please try again.', type: 'error' },
  scanInitiatedAuto: { title: 'Scan initiated', desc: 'Updating risk data for {Name}.', type: 'info' },
  scanInitiatedBulk: { title: 'Scan initiated', desc: 'Updating risk data for {N} suppliers. This may take a few moments.', type: 'info' },
  scanComplete: { title: 'Scan complete', desc: 'Risk data has been updated for {N} suppliers.', type: 'success', action: 'View Results' },
  scanFailed: { title: 'Scan failed', desc: 'We couldn\'t complete the risk scan. Please try again.', type: 'error' },
  supplierRemoved: { title: 'Supplier removed', desc: '{Name} is no longer being monitored.', type: 'info', hasUndo: true },
  supplierRestored: { title: 'Supplier restored', desc: '{Name} is being monitored again.', type: 'success' },
  securityAlert: { title: 'Security alert', desc: '{Supplier} triggered a security alert: {message}.', type: 'error', action: 'View Alert' },
  highRiskDetected: { title: 'High risk detected', desc: '{Supplier}\'s risk level has changed to High.', type: 'warning', action: 'View Supplier' },
  eventPublished: { title: 'Event published', desc: 'A simulated event has been published to the system.', type: 'info' }
};

function ToastItem({ toast, onClose }) {
  const [expanded, setExpanded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(toast.persist ? 999999 : 5000); // 5 seconds
  const timerRef = useRef(null);

  const config = STATUS_CONFIGS[toast.type] || STATUS_CONFIGS.info;
  const { color, bgLight, borderLight, shadow, Icon } = config;

  const handleClose = useCallback((wasUndone = false) => {
    if (toast.onDismiss) {
      toast.onDismiss(wasUndone);
    }
    onClose();
  }, [toast, onClose]);

  // Manage draining progress bar countdown
  useEffect(() => {
    if (toast.persist) return;
    if (paused || timeLeft <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 100) {
          clearInterval(timerRef.current);
          handleClose(false);
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, timeLeft, handleClose]);

  const togglePause = (e) => {
    e.stopPropagation();
    setPaused(prev => !prev);
  };

  const remainingSeconds = Math.ceil(timeLeft / 1000);

  return (
    <div
      className="toast-in"
      style={{
        width: 320,
        background: '#141313',
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, sans-serif',
        transition: 'all 0.3s ease',
        pointerEvents: 'auto',
        border: `1px solid ${color}`,
        overflow: 'hidden',
      }}
    >
      {/* Header Row */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
        {/* Status Circle Icon */}
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            backgroundColor: bgLight,
            borderColor: borderLight,
            borderWidth: 1,
            borderStyle: 'solid',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Icon style={{ width: 14, height: 14, color: color }} />
        </div>

        {/* Bold Title */}
        <span style={{
          flexGrow: 1,
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          userSelect: 'none'
        }}>
          {toast.title}
        </span>

        {/* Special Inline Undo for Supplier Removed Event */}
        {toast.hasUndo && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (toast.onUndo) toast.onUndo();
              handleClose(true);
            }}
            style={{
              padding: '2px 8px',
              fontSize: 12,
              fontWeight: 700,
              color: '#4285F4',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 4,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background-color 0.2s',
            }}
          >
            Undo
          </button>
        )}

        {/* Actions (Chevron and Close X) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'rgba(255, 255, 255, 0.4)'
        }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(prev => !prev);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              padding: 2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'inherit'}
          >
            <ChevronDown
              style={{
                width: 16,
                height: 16,
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}
            />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose(false);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              padding: 2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'inherit'}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </div>

      {/* Expanded Content State - ONLY visible when expanded is true */}
      {expanded && toast.desc ? (
        <div style={{
          padding: '0 16px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <p style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: 13,
            lineHeight: '20px',
            margin: 0
          }}>
            {toast.desc}
          </p>
          {toast.action && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (toast.onAction) toast.onAction();
                handleClose(false);
              }}
              style={{
                alignSelf: 'flex-start',
                padding: '6px 12px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                color: '#fff',
                background: 'transparent',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {toast.action}
            </button>
          )}
        </div>
      ) : null}

      {/* Progress Bar — full card width */}
      <div style={{
        width: '100%',
        height: 3,
        background: 'rgba(255, 255, 255, 0.05)',
        overflow: 'hidden'
      }}>
        <div 
          style={{ 
            height: '100%',
            backgroundColor: color,
            width: `${(timeLeft / 5000) * 100}%`,
            transition: 'width 0.1s linear'
          }}
        />
      </div>

      {/* Footer Text Section */}
      {!toast.persist && (
        <div 
          onClick={togglePause}
          style={{
            background: 'rgba(0, 0, 0, 0.2)',
            padding: '8px 16px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            userSelect: 'none',
            cursor: 'pointer',
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
          }}
        >
          <span style={{
            fontSize: 11,
            color: 'rgba(255, 255, 255, 0.5)',
            textAlign: 'center'
          }}>
            This message will close in {remainingSeconds} seconds. {paused ? 'Click to resume.' : 'Click to stop.'}
          </span>
        </div>
      )}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const triggerToast = useCallback((title, type = 'info', desc = '', options = {}) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);

    const newToast = {
      id,
      title,
      type,
      desc,
      hasUndo: options.hasUndo || false,
      action: options.action || null,
      onUndo: options.onUndo || null,
      onAction: options.onAction || null,
      onDismiss: options.onDismiss || null,
      persist: options.persist || false,
    };

    // Replace the old toast, triggering its onDismiss callback first (if any) to flush updates
    setToasts(prev => {
      prev.forEach(t => {
        if (t.onDismiss) {
          t.onDismiss(false);
        }
      });
      return [newToast];
    });

    return id;
  }, []);

  const showToast = useCallback((titleOrKey, param = '', options = {}) => {
    const catalogConfig = TOAST_CATALOG[titleOrKey];

    let finalTitle = titleOrKey;
    let finalDesc = '';
    let finalType = 'info';
    let finalAction = options.action || null;
    let finalHasUndo = options.hasUndo || false;

    if (catalogConfig) {
      finalTitle = catalogConfig.title;
      finalDesc = catalogConfig.desc;
      finalType = catalogConfig.type;
      finalAction = catalogConfig.action || options.action || null;
      finalHasUndo = catalogConfig.hasUndo || options.hasUndo || false;
    } else {
      // Legacy key compatibility
      const legacyMap = {
        'csvSuccess': 'suppliersImported',
        'csvFail': 'importFailed',
        'scanStarted': 'scanInitiatedBulk',
        'scanFail': 'scanFailed',
        'simulated': 'eventPublished',
        'alert': 'securityAlert',
        'riskChange': 'highRiskDetected'
      };
      const mappedKey = legacyMap[titleOrKey];
      const mappedConfig = mappedKey ? TOAST_CATALOG[mappedKey] : null;
      if (mappedConfig) {
        finalTitle = mappedConfig.title;
        finalDesc = mappedConfig.desc;
        finalType = mappedConfig.type;
        finalAction = mappedConfig.action || options.action || null;
        finalHasUndo = mappedConfig.hasUndo || options.hasUndo || false;
      } else {
        // Direct string fallback
        finalDesc = typeof param === 'string' ? param : '';
      }
    }

    // Interpolate parameters in title and desc
    if (param) {
      if (typeof param === 'object') {
        Object.keys(param).forEach(k => {
          const val = param[k];
          finalTitle = finalTitle.replace(new RegExp(`\\{${k}\\}`, 'gi'), val);
          finalDesc = finalDesc.replace(new RegExp(`\\{${k}\\}`, 'gi'), val);
        });
      } else {
        // String/Number param
        finalTitle = finalTitle
          .replace(/{Name}/gi, param)
          .replace(/{N}/gi, param)
          .replace(/{Supplier}/gi, param);
        finalDesc = finalDesc
          .replace(/{Name}/gi, param)
          .replace(/{N}/gi, param)
          .replace(/{Supplier}/gi, param);
      }
    }

    return triggerToast(finalTitle, finalType, finalDesc, {
      hasUndo: finalHasUndo,
      action: finalAction,
      onUndo: options.onUndo,
      onAction: options.onAction,
      onDismiss: options.onDismiss,
      persist: options.persist || false
    });
  }, [triggerToast]);

  return (
    <ToastContext.Provider value={{ triggerToast, showToast, removeToast, toasts }}>
      {children}

      <div
        className="fixed bottom-24 right-6 flex flex-col gap-3 z-[9999] pointer-events-none"
        style={{
          maxHeight: 'calc(100vh - 120px)',
          overflowY: 'auto',
          padding: '8px',
          paddingRight: '12px',
          marginRight: '-8px',
          marginBottom: '-8px'
        }}
      >
        {toasts.map(toast => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
