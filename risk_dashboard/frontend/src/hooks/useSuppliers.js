import { useState, useEffect, useCallback } from 'react';

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/suppliers');
      const json = await res.json();
      setSuppliers(json);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const uploadCsv = useCallback(async (file) => {
    const form = new FormData();
    form.append('file', file);
    const res  = await fetch('/api/suppliers/upload-csv', {
      method: 'POST', body: form
    });
    if (!res.ok) throw new Error('Upload failed');
    const json = await res.json();
    await refresh();
    return json;
  }, [refresh]);

  const uploadBulk = useCallback(async (suppliersList) => {
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suppliers: suppliersList })
    });
    if (!res.ok) throw new Error('Upload failed');
    const json = await res.json();
    await refresh();
    return json;
  }, [refresh]);

  const deleteSupplier = useCallback(async (name) => {
    const res = await fetch(
      `/api/suppliers/${encodeURIComponent(name)}`,
      { method: 'DELETE' }
    );
    if (!res.ok) throw new Error('Delete failed');
    await refresh();
  }, [refresh]);

  const triggerScan = useCallback(async () => {
    const res  = await fetch('/api/suppliers/trigger-scan', { method: 'POST' });
    if (!res.ok) throw new Error('Scan trigger failed');
    return await res.json();
  }, []);

  return { suppliers, loading, error, uploadCsv, uploadBulk, deleteSupplier,
           triggerScan, refresh };
}
