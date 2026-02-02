import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getActiveProfile,
  getLocationCoordinates,
  monitorProductPrices,
  calculateStats
} from '../lib/priceMonitorService';
import type {
  PriceMonitorState,
  MonitoredProduct,
  PriceComparisonStats
} from '../types';

const AUTO_REFRESH_INTERVAL = 15 * 60 * 1000;

export function usePriceMonitor() {
  const [state, setState] = useState<PriceMonitorState>({
    profile: null,
    products: [],
    loading: true,
    error: null,
    lastUpdate: null,
    isAutoRefreshing: false
  });

  const [stats, setStats] = useState<PriceComparisonStats>({
    total_products: 0,
    products_monitored: 0,
    competitive_count: 0,
    moderate_count: 0,
    high_count: 0,
    no_price_count: 0,
    avg_savings_percentage: 0
  });

  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMonitoringRef = useRef(false);

  const fetchPrices = useCallback(async (isAutoRefresh = false) => {
    if (isMonitoringRef.current) {
      console.log('Already monitoring, skipping...');
      return;
    }

    isMonitoringRef.current = true;

    setState(prev => ({
      ...prev,
      loading: !isAutoRefresh,
      isAutoRefreshing: isAutoRefresh,
      error: null
    }));

    try {
      const profile = await getActiveProfile();
      console.log('[PriceMonitor] Active profile:', profile);

      if (!profile) {
        setState({
          profile: null,
          products: [],
          loading: false,
          error: null,
          lastUpdate: null,
          isAutoRefreshing: false
        });
        setStats({
          total_products: 0,
          products_monitored: 0,
          competitive_count: 0,
          moderate_count: 0,
          high_count: 0,
          no_price_count: 0,
          avg_savings_percentage: 0
        });
        isMonitoringRef.current = false;
        return;
      }

      if (!profile.products || profile.products.length === 0) {
        setState({
          profile,
          products: [],
          loading: false,
          error: null,
          lastUpdate: new Date(),
          isAutoRefreshing: false
        });
        setStats({
          total_products: 0,
          products_monitored: 0,
          competitive_count: 0,
          moderate_count: 0,
          high_count: 0,
          no_price_count: 0,
          avg_savings_percentage: 0
        });
        isMonitoringRef.current = false;
        return;
      }

      const coordinates = await getLocationCoordinates(profile);
      console.log('[PriceMonitor] Coordinates:', coordinates);

      if (!coordinates) {
        throw new Error(
          profile.location_type === 'auto'
            ? 'Localização não configurada. Por favor, edite o perfil e capture sua localização.'
            : 'Coordenadas da cidade não disponíveis'
        );
      }

      const monitoredProducts = await monitorProductPrices(profile, coordinates);
      console.log('[PriceMonitor] Monitored products result:', monitoredProducts);
      const newStats = calculateStats(monitoredProducts);

      setState({
        profile,
        products: monitoredProducts,
        loading: false,
        error: null,
        lastUpdate: new Date(),
        isAutoRefreshing: false
      });

      setStats(newStats);
    } catch (error) {
      console.error('Error fetching prices:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Erro ao carregar preços',
        isAutoRefreshing: false
      }));
    } finally {
      isMonitoringRef.current = false;
    }
  }, []);

  const refresh = useCallback(() => {
    fetchPrices(false);
  }, [fetchPrices]);

  useEffect(() => {
    fetchPrices(false);
  }, [fetchPrices]);

  useEffect(() => {
    if (state.profile && !state.loading && !state.error) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }

      refreshIntervalRef.current = setInterval(() => {
        fetchPrices(true);
      }, AUTO_REFRESH_INTERVAL);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [state.profile, state.loading, state.error, fetchPrices]);

  return {
    profile: state.profile,
    products: state.products,
    stats,
    loading: state.loading,
    error: state.error,
    lastUpdate: state.lastUpdate,
    isAutoRefreshing: state.isAutoRefreshing,
    refresh
  };
}
