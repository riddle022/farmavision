import { useState, useEffect } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
}

const PARANA_BOUNDS = {
  minLat: -26.7,
  maxLat: -22.5,
  minLng: -54.6,
  maxLng: -47.9
};

const isInParana = (lat: number, lng: number): boolean => {
  return lat >= PARANA_BOUNDS.minLat &&
         lat <= PARANA_BOUNDS.maxLat &&
         lng >= PARANA_BOUNDS.minLng &&
         lng <= PARANA_BOUNDS.maxLng;
};

export const useGeolocation = (enabled: boolean = false) => {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: false
  });

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocalização não é suportada pelo seu navegador',
        loading: false
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        if (!isInParana(latitude, longitude)) {
          setState({
            latitude: null,
            longitude: null,
            error: 'Sua localização está fora do estado do Paraná. Por favor, selecione uma cidade manualmente.',
            loading: false
          });
          return;
        }

        setState({
          latitude,
          longitude,
          error: null,
          loading: false
        });
      },
      (error) => {
        let errorMessage = 'Erro ao obter localização';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permissão de localização negada. Por favor, habilite nas configurações do navegador.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Informação de localização indisponível.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Tempo esgotado ao tentar obter localização.';
            break;
        }

        setState({
          latitude: null,
          longitude: null,
          error: errorMessage,
          loading: false
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  useEffect(() => {
    if (enabled) {
      getCurrentLocation();
    }
  }, [enabled]);

  return {
    ...state,
    refetch: getCurrentLocation
  };
};
