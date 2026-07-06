import { useState, useEffect, useCallback } from 'react';

export function useEvents(interval = 30000) {
  const [data, setData] = useState(() => {
    try {
      const stored = localStorage.getItem('dashboard_events');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(() => {
    try {
      const stored = localStorage.getItem('dashboard_events_last_fetched');
      return stored ? new Date(stored) : null;
    } catch {
      return null;
    }
  });

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error('Failed to fetch events');
      const json = await res.json();
      setData(json);
      const now = new Date();
      setLastFetched(now);
      setError(null);
      try {
        localStorage.setItem('dashboard_events', JSON.stringify(json));
        localStorage.setItem('dashboard_events_last_fetched', now.toISOString());
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
