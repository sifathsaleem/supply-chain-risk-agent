import React, { useState, useEffect, useRef } from 'react';
import CsvUploadZone from './CsvUploadZone';
import SupplierTable from './SupplierTable';
import CsvPreviewModal from './CsvPreviewModal';
import { useToast } from '../../context/ToastContext';

const SCAN_TIMEOUT_MS = 180000; // 3 minutes safety timeout

export default function SupplierTab({ suppliersState, riskScoresState }) {
  const { 
    suppliers, 
    setSuppliers,
    loading: suppliersLoading, 
    uploadBulk, 
    uploadCsv,
    deleteSupplier, 
    triggerScan,
    addOptimistic,
    confirmOptimistic,
    rollbackOptimistic,
    failedAddsOnReload,
    recoveryPreset,
    clearRecovery
  } = suppliersState;
  
  const { refetch: refetchRiskScores } = riskScoresState;
  const { showToast, triggerToast, removeToast } = useToast();
  
  const [bulkScanTargets, setBulkScanTargets] = useState([]);
  const [activePerRowScans, setActivePerRowScans] = useState([]);
  const pollIntervalRef = useRef(null);

  // Track active scan details to enforce correct pending status lifecycle and 3-min timeout
  // mapping: supplier_name -> { triggeredAt: number, previousLastUpdated: string | null }
  const activeScansRef = useRef({});

  // Refs for tracking offline state and session
  const offlineToastIdRef = useRef(null);
  const scanSessionRef = useRef({ completedCount: 0 });

  // Modal control states lifted here for reload recovery preset
  const [showAdd, setShowAdd] = useState(false);
  const [addSupplierFormPreset, setAddSupplierFormPreset] = useState(null);

  // Computed pending names array to drive visual badge updates
  const pendingScanNames = [...new Set([...bulkScanTargets, ...activePerRowScans])];

  // Refs to avoid stale closures in the polling interval
  const bulkScanTargetsRef = useRef(bulkScanTargets);
  const activePerRowScansRef = useRef(activePerRowScans);

  useEffect(() => {
    bulkScanTargetsRef.current = bulkScanTargets;
  }, [bulkScanTargets]);

  useEffect(() => {
    activePerRowScansRef.current = activePerRowScans;
  }, [activePerRowScans]);

  // CSV Preview state
  const [csvRows, setCsvRows] = useState([]);
  const [showCsvModal, setShowCsvModal] = useState(false);

  const hasPending = bulkScanTargets.length > 0 || activePerRowScans.length > 0;

  // Recovery useEffect: Triggered when useSuppliers recovers failed SAVING rows from localStorage
  useEffect(() => {
    if (failedAddsOnReload && failedAddsOnReload.length > 0) {
      failedAddsOnReload.forEach(s => {
        showToast('failedToAdd', s.supplier_name);
      });
      if (recoveryPreset) {
        setAddSupplierFormPreset(recoveryPreset);
        setShowAdd(true);
      }
      clearRecovery();
    }
  }, [failedAddsOnReload, recoveryPreset, showToast, clearRecovery]);

  // Restore PENDING rows on reload: set activePerRowScans and activeScansRef so polling begins immediately
  useEffect(() => {
    const pendingRestored = suppliers.filter(s => s.state === 'PENDING').map(s => s.supplier_name);
    if (pendingRestored.length > 0) {
      const storedScores = (() => {
        try {
          const stored = localStorage.getItem('dashboard_risk_scores');
          return stored ? JSON.parse(stored) : [];
        } catch {
          return [];
        }
      })();
      const now = Date.now();
      pendingRestored.forEach(name => {
        const scoreObj = storedScores.find(r => r.supplier_name === name);
        activeScansRef.current[name] = {
          triggeredAt: now,
          previousLastUpdated: scoreObj ? scoreObj.last_updated : null
        };
      });
      setActivePerRowScans(prev => [...new Set([...prev, ...pendingRestored])]);
    }
  }, []);

  // Polling loop
  useEffect(() => {
    if (!hasPending) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (offlineToastIdRef.current) {
        removeToast(offlineToastIdRef.current);
        offlineToastIdRef.current = null;
      }
      return;
    }

    if (pollIntervalRef.current) return;

    pollIntervalRef.current = setInterval(async () => {
      // 1. Detect if offline via navigator.onLine
      const isOffline = !navigator.onLine;

      if (isOffline) {
        if (!offlineToastIdRef.current) {
          offlineToastIdRef.current = triggerToast(
            "You appear to be offline.",
            "info",
            "Scan results will apply when connection is restored.",
            { persist: true }
          );
        }
      }

      let currentScores = null;
      if (!isOffline) {
        try {
          currentScores = await refetchRiskScores();
          // If polling succeeded, we are online. Remove offline toast if present.
          if (offlineToastIdRef.current) {
            removeToast(offlineToastIdRef.current);
            offlineToastIdRef.current = null;
          }
        } catch (err) {
          // Failed polling request acts as offline/connection lost
          if (!offlineToastIdRef.current) {
            offlineToastIdRef.current = triggerToast(
              "You appear to be offline.",
              "info",
              "Scan results will apply when connection is restored.",
              { persist: true }
            );
          }
        }
      }

      const currentBulk = bulkScanTargetsRef.current;
      const currentPerRow = activePerRowScansRef.current;

      let nextBulk = currentBulk;
      let nextPerRow = currentPerRow;

      const now = Date.now();
      const activeScans = activeScansRef.current;
      const completedNames = [];

      // Check if any supplier has timed out
      let hasAnyTimeout = false;
      Object.keys(activeScans).forEach(name => {
        const scanInfo = activeScans[name];
        if (scanInfo && (now - scanInfo.triggeredAt > SCAN_TIMEOUT_MS)) {
          hasAnyTimeout = true;
        }
      });

      if (hasAnyTimeout) {
        // Collect all remaining pending suppliers to fail them all
        const timedOutNames = Object.keys(activeScans);

        // Remove from activeScansRef
        timedOutNames.forEach(name => {
          delete activeScans[name];
        });

        // Rollback row states back to previous
        setSuppliers(prev => prev.map(s => {
          if (timedOutNames.includes(s.supplier_name)) {
            const hasScore = riskScoresState.data.some(r => r.supplier_name === s.supplier_name);
            return { ...s, state: hasScore ? 'ASSESSED' : 'NOT_ASSESSED' };
          }
          return s;
        }));

        // Fire toast
        if (scanSessionRef.current.completedCount === 0) {
          triggerToast(
            'Scan failed',
            'error',
            'The scan is taking longer than expected. Please try again.'
          );
        } else {
          triggerToast(
            'Scan failed',
            'error',
            `${timedOutNames.length} supplier${timedOutNames.length !== 1 ? 's' : ''} could not be scanned. Please try again.`
          );
        }

        // Clean up offline toast if visible
        if (offlineToastIdRef.current) {
          removeToast(offlineToastIdRef.current);
          offlineToastIdRef.current = null;
        }

        // Clear all remaining targets
        setBulkScanTargets([]);
        setActivePerRowScans([]);
        
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        return;
      }

      // If we have successful scores, match them
      if (currentScores) {
        Object.keys(activeScans).forEach(name => {
          const scanInfo = activeScans[name];
          if (!scanInfo) return;

          const scoreObj = currentScores.find(r => r.supplier_name === name);
          if (scoreObj) {
            const isNewResult = scanInfo.previousLastUpdated 
              ? (scoreObj.last_updated !== scanInfo.previousLastUpdated)
              : true;
            if (isNewResult) {
              completedNames.push(name);
              delete activeScans[name];
            }
          }
        });

        if (completedNames.length > 0) {
          // Increment completed count
          scanSessionRef.current.completedCount += completedNames.length;

          setSuppliers(prev => prev.map(s => {
            if (completedNames.includes(s.supplier_name)) {
              return { ...s, state: 'ASSESSED' };
            }
            return s;
          }));

          nextBulk = currentBulk.filter(name => !completedNames.includes(name));
          nextPerRow = currentPerRow.filter(name => !completedNames.includes(name));

          if (nextBulk.length !== currentBulk.length) {
            setBulkScanTargets(nextBulk);
          }
          if (nextPerRow.length !== currentPerRow.length) {
            setActivePerRowScans(nextPerRow);
          }
        }
      }

      const totalRemaining = nextBulk.length + nextPerRow.length;
      if (totalRemaining === 0) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }, 3000);

    return () => {
      // Clean up interval and persistent toast on component hasPending shift or unmount
      if (pollIntervalRef.current && !hasPending) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [hasPending, refetchRiskScores, setSuppliers, riskScoresState.data]);

  // Make sure we also clean up on component unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (offlineToastIdRef.current) {
        removeToast(offlineToastIdRef.current);
        offlineToastIdRef.current = null;
      }
    };
  }, []);

  const handleFileParsed = (rows) => {
    setCsvRows(rows);
    setShowCsvModal(true);
  };

  const handleCsvConfirm = async (validRows) => {
    setShowCsvModal(false);
    const localDate = new Date().toLocaleDateString('en-CA');
    const rowsWithTime = validRows.map(row => ({
      ...row,
      added_date: row.added_date || localDate
    }));

    addOptimistic(rowsWithTime);

    // Background uploading execution
    (async () => {
      try {
        // Convert rows to a clean CSV File to call upload-csv endpoint
        const csvHeaders = 'supplier_name,country,category,added_date\n';
        const csvContent = rowsWithTime.map(r => 
          `"${r.supplier_name.replace(/"/g, '""')}","${r.country.replace(/"/g, '""')}","${r.category.replace(/"/g, '""')}","${r.added_date}"`
        ).join('\n');
        const csvBlob = new Blob([csvHeaders + csvContent], { type: 'text/csv;charset=utf-8;' });
        const csvFile = new File([csvBlob], 'import.csv', { type: 'text/csv' });

        await uploadCsv(csvFile);
        confirmOptimistic(rowsWithTime);

        // Auto-trigger scan for all of them together
        const targetNames = rowsWithTime.map(r => r.supplier_name);
        handleScan(targetNames, false);

        showToast('suppliersImported', validRows.length);
        await refetchRiskScores();
      } catch (err) {
        rollbackOptimistic(rowsWithTime);
        showToast('importFailed');
        setShowCsvModal(true);
      }
    })();
  };

  const handleScan = async (targetNames, isPerRow = false) => {
    if (!targetNames || targetNames.length === 0) return;
    
    // Reset completed count if starting a fresh scan session
    if (bulkScanTargets.length === 0 && activePerRowScans.length === 0) {
      scanSessionRef.current.completedCount = 0;
    }

    if (isPerRow) {
      setActivePerRowScans(prev => [...new Set([...prev, ...targetNames])]);
    } else {
      setBulkScanTargets(prev => [...new Set([...prev, ...targetNames])]);
    }

    // Set row state to PENDING in suppliers list
    setSuppliers(prev => prev.map(s => {
      if (targetNames.includes(s.supplier_name)) {
        return { ...s, state: 'PENDING' };
      }
      return s;
    }));

    // Record the triggered timestamp and last_updated timestamp at moment of scan initiation
    const now = Date.now();
    targetNames.forEach(name => {
      const scoreObj = riskScoresState.data.find(r => r.supplier_name === name);
      activeScansRef.current[name] = {
        triggeredAt: now,
        previousLastUpdated: scoreObj ? scoreObj.last_updated : null
      };
    });
    
    try {
      await triggerScan(targetNames);
      // Firing toast accepts job but doesn't change badge state
      if (isPerRow) {
        showToast('scanInitiatedAuto', targetNames[0]);
      } else {
        showToast('scanInitiatedBulk', targetNames.length);
      }
    } catch (e) {
      triggerToast(
        'Scan failed',
        'error',
        "We couldn't start the scan. Please check your connection and try again."
      );
      
      // Rollback row state back to previous
      setSuppliers(prev => prev.map(s => {
        if (targetNames.includes(s.supplier_name)) {
          const hasScore = riskScoresState.data.some(r => r.supplier_name === s.supplier_name);
          return { ...s, state: hasScore ? 'ASSESSED' : 'NOT_ASSESSED' };
        }
        return s;
      }));

      // Clean up scanning record
      targetNames.forEach(name => {
        delete activeScansRef.current[name];
      });

      if (isPerRow) {
        setActivePerRowScans(prev => prev.filter(name => !targetNames.includes(name)));
      } else {
        setBulkScanTargets(prev => prev.filter(name => !targetNames.includes(name)));
      }
    }
  };

  return (
    <div style={{width:'100%', maxWidth:1280, margin:'0 auto', padding:'32px 24px', display:'flex', flexDirection:'column', gap:32}}>
      {/* Upload Zone */}
      <CsvUploadZone onFileParsed={handleFileParsed} />

      {/* Supplier Table */}
      <SupplierTable
        suppliers={suppliers}
        setSuppliers={setSuppliers}
        riskScores={riskScoresState.data}
        loading={suppliersLoading}
        onDelete={deleteSupplier}
        onScan={handleScan}
        onAddSupplier={uploadBulk}
        pendingScanNames={pendingScanNames}
        activePerRowScans={activePerRowScans}
        bulkScanTargets={bulkScanTargets}
        addOptimistic={addOptimistic}
        confirmOptimistic={confirmOptimistic}
        rollbackOptimistic={rollbackOptimistic}
        showAdd={showAdd}
        setShowAdd={setShowAdd}
        addSupplierFormPreset={addSupplierFormPreset}
        setAddSupplierFormPreset={setAddSupplierFormPreset}
      />

      {showCsvModal && (
        <CsvPreviewModal
          rows={csvRows}
          onClose={() => setShowCsvModal(false)}
          onConfirm={handleCsvConfirm}
          existingSuppliers={suppliers}
        />
      )}
    </div>
  );
}
