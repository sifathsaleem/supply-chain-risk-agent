import { useState, useEffect, useCallback } from 'react';

export function useAlerts(interval = 30000) {
  const [data, setData] = useState(() => {
    try {
      const stored = localStorage.getItem('dashboard_alerts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(() => {
    try {
      const stored = localStorage.getItem('dashboard_alerts_last_fetched');
      return stored ? new Date(stored) : null;
    } catch {
      return null;
    }
  });

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
      if (!res.ok) throw new Error('Failed to fetch alerts');
      const json = await res.json();
      setData(json);
      const now = new Date();
      setLastFetched(now);
      setError(null);
      try {
        localStorage.setItem('dashboard_alerts', JSON.stringify(json));
        localStorage.setItem('dashboard_alerts_last_fetched', now.toISOString());
      } catch (e) {
        console.error(e);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, interval);
    return () => clearInterval(id);
  }, [fetch_, interval]);

  return { data, loading, error, lastFetched, refetch: fetch_ };
}
