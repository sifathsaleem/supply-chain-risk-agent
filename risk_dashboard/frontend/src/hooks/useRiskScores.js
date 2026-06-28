import { useState, useEffect, useCallback } from 'react';
const INTERVAL = 30000;
export function useRiskScores() {
  const [data, setData]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const fetch_ = useCallback(async () => {
    try {
      const res  = await fetch('/api/risk-scores');
      const json = await res.json();
      setData(json);
      setLastFetched(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, INTERVAL);
    return () => clearInterval(id);
  }, [fetch_]);

  return { data, loading, error, lastFetched, refetch: fetch_ };
}
