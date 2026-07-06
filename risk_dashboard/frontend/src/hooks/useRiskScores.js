import { useState, useEffect, useCallback } from 'react';

export function useRiskScores(interval = 30000) {
  const [data, setData] = useState(() => {
    try {
      const stored = localStorage.getItem('dashboard_risk_scores');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(() => {
    try {
      const stored = localStorage.getItem('dashboard_risk_scores_last_fetched');
      return stored ? new Date(stored) : null;
    } catch {
      return null;
    }
  });

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/risk-scores');
      if (!res.ok) throw new Error('Failed to fetch risk scores');
      const json = await res.json();
      setData(json);
      const now = new Date();
      setLastFetched(now);
      setError(null);
      try {
        localStorage.setItem('dashboard_risk_scores', JSON.stringify(json));
        localStorage.setItem('dashboard_risk_scores_last_fetched', now.toISOString());
      } catch (e) {
        console.error(e);
      }
      return json;
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
