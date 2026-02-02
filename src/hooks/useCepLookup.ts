import { useState } from 'react';

interface CepLookupState {
  loading: boolean;
  error: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
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

const formatCep = (cep: string): string => {
  return cep.replace(/\D/g, '');
};

const validateCepFormat = (cep: string): boolean => {
  const cleanCep = formatCep(cep);
  return cleanCep.length === 8 && /^\d+$/.test(cleanCep);
};

export const useCepLookup = () => {
  const [state, setState] = useState<CepLookupState>({
    loading: false,
    error: null,
    address: null,
    latitude: null,
    longitude: null
  });

  const lookupCep = async (cep: string): Promise<CepLookupState> => {
    if (!validateCepFormat(cep)) {
      const errorState = {
        loading: false,
        error: 'CEP inválido. Use o formato 12345-678 ou 12345678',
        address: null,
        latitude: null,
        longitude: null
      };
      setState(errorState);
      return errorState;
    }

    setState({
      loading: true,
      error: null,
      address: null,
      latitude: null,
      longitude: null
    });

    try {
      const cleanCep = formatCep(cep);

      const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);

      if (!viaCepResponse.ok) {
        throw new Error('Erro ao consultar CEP');
      }

      const viaCepData: ViaCepResponse = await viaCepResponse.json();

      if (viaCepData.erro) {
        throw new Error('CEP não encontrado');
      }

      if (viaCepData.uf !== 'PR') {
        throw new Error('CEP está fora do estado do Paraná. Por favor, use uma localização válida do Paraná.');
      }

      const fullAddress = `${viaCepData.logradouro}, ${viaCepData.bairro}, ${viaCepData.localidade} - ${viaCepData.uf}, ${viaCepData.cep}`;

      const geocodeQuery = encodeURIComponent(
        `${viaCepData.logradouro}, ${viaCepData.localidade}, ${viaCepData.uf}, Brasil`
      );

      const nominatimResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${geocodeQuery}&limit=1`,
        {
          headers: {
            'User-Agent': 'PriceMonitorApp/1.0'
          }
        }
      );

      if (!nominatimResponse.ok) {
        throw new Error('Erro ao obter coordenadas');
      }

      const nominatimData: NominatimResponse[] = await nominatimResponse.json();

      if (!nominatimData || nominatimData.length === 0) {
        throw new Error('Não foi possível obter coordenadas para este CEP');
      }

      const latitude = parseFloat(nominatimData[0].lat);
      const longitude = parseFloat(nominatimData[0].lon);

      if (!isInParana(latitude, longitude)) {
        throw new Error('As coordenadas do CEP estão fora do estado do Paraná');
      }

      const successState = {
        loading: false,
        error: null,
        address: fullAddress,
        latitude,
        longitude
      };

      setState(successState);
      return successState;
    } catch (error: any) {
      const errorState = {
        loading: false,
        error: error.message || 'Erro ao buscar CEP',
        address: null,
        latitude: null,
        longitude: null
      };
      setState(errorState);
      return errorState;
    }
  };

  const reset = () => {
    setState({
      loading: false,
      error: null,
      address: null,
      latitude: null,
      longitude: null
    });
  };

  return {
    ...state,
    lookupCep,
    reset,
    validateCepFormat,
    formatCep
  };
};
