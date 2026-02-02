import { useState, useCallback } from 'react';
import {
  searchCategories,
  searchProducts,
  searchFuel,
  fetchSnapshot
} from '../lib/menorPrecoApi';
import type {
  SearchCategoriesResponse,
  SearchProductsResponse,
  SearchFuelResponse,
  SnapshotResponse,
  SearchParams,
  FuelType
} from '../types';

interface SearchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useMenorPrecoSearch() {
  const [categoriesState, setCategoriesState] = useState<SearchState<SearchCategoriesResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  const [productsState, setProductsState] = useState<SearchState<SearchProductsResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  const [fuelState, setFuelState] = useState<SearchState<SearchFuelResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  const [snapshotState, setSnapshotState] = useState<SearchState<SnapshotResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  const searchCategoriesAction = useCallback(async (params: SearchParams) => {
    setCategoriesState({ data: null, loading: true, error: null });
    try {
      const data = await searchCategories(params);
      setCategoriesState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar categorias';
      setCategoriesState({ data: null, loading: false, error: errorMessage });
      throw error;
    }
  }, []);

  const searchProductsAction = useCallback(async (params: SearchParams) => {
    setProductsState({ data: null, loading: true, error: null });
    try {
      const data = await searchProducts(params);
      setProductsState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar produtos';
      setProductsState({ data: null, loading: false, error: errorMessage });
      throw error;
    }
  }, []);

  const searchFuelAction = useCallback(async (
    tipo: FuelType,
    params: Omit<SearchParams, 'termo' | 'categoria' | 'ordem'>
  ) => {
    setFuelState({ data: null, loading: true, error: null });
    try {
      const data = await searchFuel(tipo, params);
      setFuelState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar combustíveis';
      setFuelState({ data: null, loading: false, error: errorMessage });
      throw error;
    }
  }, []);

  const fetchSnapshotAction = useCallback(async (
    termos: string[],
    params: Omit<SearchParams, 'termo' | 'categoria' | 'ordem' | 'tipo'>
  ) => {
    setSnapshotState({ data: null, loading: true, error: null });
    try {
      const data = await fetchSnapshot(termos, params);
      setSnapshotState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar snapshot';
      setSnapshotState({ data: null, loading: false, error: errorMessage });
      throw error;
    }
  }, []);

  const clearCategories = useCallback(() => {
    setCategoriesState({ data: null, loading: false, error: null });
  }, []);

  const clearProducts = useCallback(() => {
    setProductsState({ data: null, loading: false, error: null });
  }, []);

  const clearFuel = useCallback(() => {
    setFuelState({ data: null, loading: false, error: null });
  }, []);

  const clearSnapshot = useCallback(() => {
    setSnapshotState({ data: null, loading: false, error: null });
  }, []);

  return {
    categories: {
      ...categoriesState,
      search: searchCategoriesAction,
      clear: clearCategories,
    },
    products: {
      ...productsState,
      search: searchProductsAction,
      clear: clearProducts,
    },
    fuel: {
      ...fuelState,
      search: searchFuelAction,
      clear: clearFuel,
    },
    snapshot: {
      ...snapshotState,
      fetch: fetchSnapshotAction,
      clear: clearSnapshot,
    },
  };
}
