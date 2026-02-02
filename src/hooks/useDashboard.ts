import { useState, useEffect, useCallback, useRef } from 'react';
import { getDashboardData, generateAIInsights, updateCompetitorScores, DashboardData } from '../lib/dashboardService';

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);

  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;

    try {
      setError(null);
      if (!forceRefresh && !data) {
        setLoading(true);
      }

      const dashboardData = await getDashboardData(forceRefresh);
      
      // Preserve AI insights during auto-refresh to prevent flickering
      if (!forceRefresh && data?.aiInsights && dashboardData.aiInsights.length === 0) {
        dashboardData.aiInsights = data.aiInsights;
      }
      
      setData(dashboardData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []); // Remove 'data' dependency to prevent infinite loop

  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  const generateInsights = useCallback(async () => {
    setGeneratingInsights(true);
    try {
      const result = await generateAIInsights();
      setData(result.dashboard);
      return result.insights;
    } catch (err) {
      console.error('Error generating insights:', err);
      throw err;
    } finally {
      setGeneratingInsights(false);
    }
  }, []);

  const updateScores = useCallback(async () => {
    try {
      await updateCompetitorScores();
      await fetchData(true);
    } catch (err) {
      console.error('Error updating scores:', err);
      throw err;
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  useEffect(() => {
    if (!loading && !error) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }

      refreshIntervalRef.current = setInterval(() => {
        fetchData(false);
      }, AUTO_REFRESH_INTERVAL);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [loading, error, fetchData]);

  return {
    data,
    loading,
    error,
    generatingInsights,
    refresh,
    generateInsights,
    updateScores,
  };
}
