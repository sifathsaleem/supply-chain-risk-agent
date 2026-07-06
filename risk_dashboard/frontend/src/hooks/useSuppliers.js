import { useState, useEffect, useCallback, useRef } from 'react';

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState(() => {
    try {
      const stored = localStorage.getItem('dashboard_suppliers');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Exclude SAVING and PENDING_DELETE rows from restored list immediately
          // (They will be processed in the recovery useEffect)
          return parsed.filter(s => s.state !== 'SAVING' && s.state !== 'PENDING_DELETE');
        }
      }
    } catch (e) {
      console.error("Failed to parse stored suppliers:", e);
    }
    return [];
  });

  const [loading, setLoading] = useState(() => {
    try {
      const stored = localStorage.getItem('dashboard_suppliers');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return false;
        }
      }
    } catch {}
    return true;
  });
  const [error, setError] = useState(null);
  const [failedAddsOnReload, setFailedAddsOnReload] = useState([]);
  const [recoveryPreset, setRecoveryPreset] = useState(null);

  const initRef = useRef(false);

  // Sync to localStorage on every meaningful state change
  useEffect(() => {
    const toSave = suppliers.filter(s => s.state !== 'SAVING' && s.state !== 'PENDING_DELETE');
    try {
      localStorage.setItem('dashboard_suppliers', JSON.stringify(toSave));
    } catch (e) {
      console.error("Failed to save suppliers to localStorage:", e);
    }
  }, [suppliers]);

  const addOptimistic = useCallback((newRows) => {
    setSuppliers(prev => {
      const tagged = newRows.map(r => ({
        ...r,
        state: 'SAVING',
        added_date: r.added_date || new Date().toISOString().split('T')[0]
      }));
      return [...tagged, ...prev];
    });
  }, []);

  const confirmOptimistic = useCallback((confirmedRows) => {
    setSuppliers(prev =>
      prev.map(s => {
        if (confirmedRows.some(cr => cr.supplier_name === s.supplier_name)) {
          return { ...s, state: 'NOT_ASSESSED' };
        }
        return s;
      })
    );
  }, []);

  const rollbackOptimistic = useCallback((failedRows) => {
    setSuppliers(prev =>
      prev.filter(s =>
        !failedRows.some(fr => fr.supplier_name === s.supplier_name)
      )
    );
  }, []);

  const refresh = useCallback(async (showSkeleton = true, currentRiskScores = []) => {
    if (showSkeleton) setLoading(true);
    try {
      const res = await fetch('/api/suppliers');
      if (!res.ok) throw new Error('Failed to fetch suppliers');
      const fetchedList = await res.json();

      setSuppliers(prev => {
        // Merge fetched list with local states
        const updated = prev.map(loc => {
          if (loc.state === 'SAVING' || loc.state === 'PENDING_DELETE') {
            return loc;
          }
          const backendRow = fetchedList.find(b => b.supplier_name === loc.supplier_name);
          if (backendRow) {
            const hasScore = currentRiskScores.some(r => r.supplier_name === loc.supplier_name);
            const nextState = loc.state === 'PENDING' ? 'PENDING' : (hasScore ? 'ASSESSED' : 'NOT_ASSESSED');
            return { ...loc, ...backendRow, state: nextState };
          }
          return null;
        }).filter(Boolean);

        // Add new backend rows not present locally
        fetchedList.forEach(b => {
          if (!updated.some(u => u.supplier_name === b.supplier_name)) {
            const hasScore = currentRiskScores.some(r => r.supplier_name === b.supplier_name);
            updated.push({
              ...b,
              state: hasScore ? 'ASSESSED' : 'NOT_ASSESSED'
            });
          }
        });

        return updated;
      });
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteSupplier = useCallback(async (name) => {
    const res = await fetch(
      `/api/suppliers/${encodeURIComponent(name)}`,
      { method: 'DELETE' }
    );
    if (!res.ok) throw new Error('Delete failed');
    setSuppliers(prev => prev.filter(s => s.supplier_name !== name));
  }, []);

  const uploadCsv = useCallback(async (file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/suppliers/upload-csv', {
      method: 'POST', body: form
    });
    if (!res.ok) throw new Error('Upload failed');
    return await res.json();
  }, []);

  const uploadBulk = useCallback(async (suppliersList) => {
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suppliers: suppliersList })
    });
    if (!res.ok) throw new Error('Upload failed');
    return await res.json();
  }, []);

  const triggerScan = useCallback(async (supplierNames) => {
    const res = await fetch('/api/suppliers/trigger-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplier_names: supplierNames || [] })
    });
    if (!res.ok) throw new Error('Scan trigger failed');
    return await res.json();
  }, []);

  // Recovery routine on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let hasCachedData = false;
    try {
      const stored = localStorage.getItem('dashboard_suppliers');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const toDelete = [];
          const toAddPreset = [];

          parsed.forEach(s => {
            if (s.state === 'SAVING') {
              toAddPreset.push(s);
            } else if (s.state === 'PENDING_DELETE') {
              toDelete.push(s.supplier_name);
            }
          });

          if (toAddPreset.length > 0) {
            setFailedAddsOnReload(toAddPreset);
            setRecoveryPreset({
              supplier_name: toAddPreset[0].supplier_name,
              country: toAddPreset[0].country,
              category: toAddPreset[0].category
            });
          }

          toDelete.forEach(name => {
            deleteSupplier(name).catch(err => console.error("Restore delete failed:", err));
          });

          const restoredValid = parsed.filter(s => s.state !== 'SAVING' && s.state !== 'PENDING_DELETE');
          if (restoredValid.length > 0) {
            hasCachedData = true;
          }
        }
      }
    } catch (e) {
      console.error("Failed to run restore rules:", e);
    }

    refresh(!hasCachedData);
  }, [deleteSupplier, refresh]);

  const clearRecovery = useCallback(() => {
    setFailedAddsOnReload([]);
    setRecoveryPreset(null);
  }, []);

  return {
    suppliers,
    setSuppliers,
    loading,
    error,
    uploadCsv,
    uploadBulk,
    deleteSupplier,
    triggerScan,
    refresh,
    addOptimistic,
    confirmOptimistic,
    rollbackOptimistic,
    failedAddsOnReload,
    recoveryPreset,
    clearRecovery
  };
}
