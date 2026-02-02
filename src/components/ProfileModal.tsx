import { useState, useEffect } from 'react';
import { X, MapPin, Radar, Package, Search, Loader2, CheckCircle2, Hash } from 'lucide-react';
import { CityParana, LocationType, Product, SearchProfile } from '../types';
import { useGeolocation } from '../hooks/useGeolocation';
import { useCepLookup } from '../hooks/useCepLookup';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (profileData: ProfileFormData) => Promise<void>;
  editingProfile?: SearchProfile | null;
  cities: CityParana[];
  availableProducts: Product[];
}

export interface ProfileFormData {
  profile_name: string;
  location_type: LocationType;
  selected_city_id: number | null;
  cep: string | null;
  search_radius_km: number;
  product_ids: number[];
  saved_latitude: number | null;
  saved_longitude: number | null;
}

export default function ProfileModal({
  isOpen,
  onClose,
  onSave,
  editingProfile,
  cities,
  availableProducts
}: ProfileModalProps) {
  const [formData, setFormData] = useState<ProfileFormData>({
    profile_name: '',
    location_type: 'city',
    selected_city_id: null,
    cep: null,
    search_radius_km: 10,
    product_ids: [],
    saved_latitude: null,
    saved_longitude: null
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectAll, setSelectAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [obtainingLocation, setObtainingLocation] = useState(false);
  const [cepInput, setCepInput] = useState('');

  const geolocation = useGeolocation(false);
  const cepLookup = useCepLookup();

  useEffect(() => {
    if (editingProfile) {
      const productIds = editingProfile.products?.map(p => p.id) || [];
      setFormData({
        profile_name: editingProfile.profile_name,
        location_type: editingProfile.location_type,
        selected_city_id: editingProfile.selected_city_id,
        cep: editingProfile.cep,
        search_radius_km: editingProfile.search_radius_km,
        product_ids: productIds,
        saved_latitude: editingProfile.saved_latitude,
        saved_longitude: editingProfile.saved_longitude
      });
      setSelectAll(productIds.length === availableProducts.length && availableProducts.length > 0);
      if (editingProfile.cep) {
        setCepInput(editingProfile.cep);
      }
    } else {
      setFormData({
        profile_name: '',
        location_type: 'city',
        selected_city_id: null,
        cep: null,
        search_radius_km: 10,
        product_ids: [],
        saved_latitude: null,
        saved_longitude: null
      });
      setSelectAll(false);
      setCepInput('');
    }
    setSearchTerm('');
    setErrors({});
    cepLookup.reset();
  }, [editingProfile, isOpen, availableProducts.length]);

  const filteredProducts = availableProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.principle_active?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectAll = () => {
    if (selectAll) {
      setFormData(prev => ({ ...prev, product_ids: [] }));
    } else {
      setFormData(prev => ({ ...prev, product_ids: availableProducts.map(p => p.id) }));
    }
    setSelectAll(!selectAll);
  };

  const handleProductToggle = (productId: number) => {
    setFormData(prev => ({
      ...prev,
      product_ids: prev.product_ids.includes(productId)
        ? prev.product_ids.filter(id => id !== productId)
        : [...prev.product_ids, productId]
    }));
  };

  const handleGetLocation = async () => {
    setObtainingLocation(true);
    setErrors(prev => ({ ...prev, location: '' }));

    try {
      geolocation.refetch();

      await new Promise<void>((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (geolocation.latitude && geolocation.longitude) {
            clearInterval(checkInterval);
            setFormData(prev => ({
              ...prev,
              saved_latitude: geolocation.latitude,
              saved_longitude: geolocation.longitude
            }));
            resolve();
          } else if (geolocation.error) {
            clearInterval(checkInterval);
            reject(new Error(geolocation.error));
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          if (!geolocation.latitude || !geolocation.longitude) {
            reject(new Error('Tempo esgotado ao obter localização'));
          }
        }, 15000);
      });
    } catch (error: any) {
      setErrors(prev => ({ ...prev, location: error.message || 'Erro ao obter localização' }));
    } finally {
      setObtainingLocation(false);
    }
  };

  useEffect(() => {
    if (formData.location_type === 'auto' && !formData.saved_latitude && !formData.saved_longitude && !obtainingLocation) {
      handleGetLocation();
    }
  }, [formData.location_type]);

  const handleCepChange = async (value: string) => {
    const formatted = value.replace(/\D/g, '');
    const withHyphen = formatted.length > 5 ? `${formatted.slice(0, 5)}-${formatted.slice(5, 8)}` : formatted;
    setCepInput(withHyphen);

    setErrors(prev => ({ ...prev, cep: '', location: '' }));

    if (formatted.length === 8) {
      const result = await cepLookup.lookupCep(formatted);

      if (result.error) {
        setErrors(prev => ({ ...prev, cep: result.error || '' }));
        setFormData(prev => ({
          ...prev,
          cep: withHyphen,
          saved_latitude: null,
          saved_longitude: null
        }));
      } else if (result.latitude && result.longitude) {
        setFormData(prev => ({
          ...prev,
          cep: withHyphen,
          saved_latitude: result.latitude,
          saved_longitude: result.longitude
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        cep: withHyphen,
        saved_latitude: null,
        saved_longitude: null
      }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.profile_name.trim()) {
      newErrors.profile_name = 'Nome do perfil é obrigatório';
    } else if (formData.profile_name.length < 3) {
      newErrors.profile_name = 'Nome deve ter pelo menos 3 caracteres';
    }

    if (formData.location_type === 'city' && !formData.selected_city_id) {
      newErrors.city = 'Selecione uma cidade';
    }

    if (formData.location_type === 'auto' && (!formData.saved_latitude || !formData.saved_longitude)) {
      newErrors.location = 'Aguardando captura de localização automática';
    }

    if (formData.location_type === 'cep') {
      if (!formData.cep || formData.cep.replace(/\D/g, '').length !== 8) {
        newErrors.cep = 'Digite um CEP válido com 8 dígitos';
      } else if (!formData.saved_latitude || !formData.saved_longitude) {
        newErrors.cep = 'Aguardando validação do CEP';
      }
    }

    if (formData.product_ids.length === 0) {
      newErrors.products = 'Selecione pelo menos um produto';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving profile:', error);
      setErrors({ submit: 'Erro ao salvar perfil. Tente novamente.' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-dark-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-dark-600 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-dark-600">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {editingProfile ? 'Editar Perfil' : 'Novo Perfil de Busca'}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Configure os parâmetros de busca de competidores
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
          >
            <X size={24} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nome do Perfil
            </label>
            <input
              type="text"
              value={formData.profile_name}
              onChange={(e) => setFormData(prev => ({ ...prev, profile_name: e.target.value }))}
              placeholder="Ex: Busca Local 5km, Busca Regional..."
              className={`w-full px-4 py-3 bg-dark-700 border ${
                errors.profile_name ? 'border-red-500' : 'border-dark-600'
              } text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent placeholder-gray-500`}
            />
            {errors.profile_name && (
              <p className="text-red-500 text-sm mt-1">{errors.profile_name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Tipo de Localização
            </label>
            <div className="grid grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, location_type: 'auto' }))}
                className={`p-4 rounded-xl border-2 transition-all ${
                  formData.location_type === 'auto'
                    ? 'border-orange-600 bg-orange-600/10'
                    : 'border-dark-600 bg-dark-700 hover:border-dark-500'
                }`}
              >
                <Radar className={`mb-2 ${
                  formData.location_type === 'auto' ? 'text-orange-500' : 'text-gray-400'
                }`} size={24} />
                <p className={`font-medium ${
                  formData.location_type === 'auto' ? 'text-white' : 'text-gray-300'
                }`}>
                  Localização Automática
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  GPS do dispositivo
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, location_type: 'city' }))}
                className={`p-4 rounded-xl border-2 transition-all ${
                  formData.location_type === 'city'
                    ? 'border-orange-600 bg-orange-600/10'
                    : 'border-dark-600 bg-dark-700 hover:border-dark-500'
                }`}
              >
                <MapPin className={`mb-2 ${
                  formData.location_type === 'city' ? 'text-orange-500' : 'text-gray-400'
                }`} size={24} />
                <p className={`font-medium ${
                  formData.location_type === 'city' ? 'text-white' : 'text-gray-300'
                }`}>
                  Selecionar Cidade
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Cidade do Paraná
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, location_type: 'cep' }))}
                className={`p-4 rounded-xl border-2 transition-all ${
                  formData.location_type === 'cep'
                    ? 'border-orange-600 bg-orange-600/10'
                    : 'border-dark-600 bg-dark-700 hover:border-dark-500'
                }`}
              >
                <Hash className={`mb-2 ${
                  formData.location_type === 'cep' ? 'text-orange-500' : 'text-gray-400'
                }`} size={24} />
                <p className={`font-medium ${
                  formData.location_type === 'cep' ? 'text-white' : 'text-gray-300'
                }`}>
                  Buscar por CEP
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Código postal
                </p>
              </button>
            </div>

            {formData.location_type === 'auto' && (
              <div className="mt-3 space-y-3">
                {obtainingLocation && (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <div className="flex items-center gap-2 text-blue-500">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm font-medium">Obtendo localização automaticamente...</span>
                    </div>
                  </div>
                )}

                {formData.saved_latitude && formData.saved_longitude && !obtainingLocation && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <div className="flex items-center gap-2 text-emerald-500 mb-1">
                      <CheckCircle2 size={16} />
                      <span className="text-sm font-medium">Localização capturada com sucesso!</span>
                    </div>
                    <p className="text-xs text-gray-400 ml-6">
                      Coordenadas: {formData.saved_latitude.toFixed(6)}, {formData.saved_longitude.toFixed(6)}
                    </p>
                  </div>
                )}

                {errors.location && !obtainingLocation && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <p className="text-red-500 text-sm">{errors.location}</p>
                  </div>
                )}

                {!obtainingLocation && !formData.saved_latitude && !errors.location && (
                  <p className="text-xs text-gray-400">
                    Aguardando permissão de localização do navegador...
                  </p>
                )}

                {formData.saved_latitude && formData.saved_longitude && (
                  <p className="text-xs text-gray-400">
                    Sua localização foi salva e será usada para todas as buscas deste perfil.
                  </p>
                )}
              </div>
            )}

            {formData.location_type === 'city' && (
              <div className="mt-3">
                <select
                  value={formData.selected_city_id || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    selected_city_id: e.target.value ? Number(e.target.value) : null
                  }))}
                  className={`w-full px-4 py-3 bg-dark-700 border ${
                    errors.city ? 'border-red-500' : 'border-dark-600'
                  } text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent`}
                >
                  <option value="">Selecione uma cidade...</option>
                  {cities.map(city => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
                {errors.city && (
                  <p className="text-red-500 text-sm mt-1">{errors.city}</p>
                )}
              </div>
            )}

            {formData.location_type === 'cep' && (
              <div className="mt-3 space-y-3">
                <div>
                  <input
                    type="text"
                    value={cepInput}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    className={`w-full px-4 py-3 bg-dark-700 border ${
                      errors.cep ? 'border-red-500' : 'border-dark-600'
                    } text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent placeholder-gray-500`}
                  />
                  {errors.cep && (
                    <p className="text-red-500 text-sm mt-1">{errors.cep}</p>
                  )}
                </div>

                {cepLookup.loading && (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <div className="flex items-center gap-2 text-blue-500">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm font-medium">Buscando informações do CEP...</span>
                    </div>
                  </div>
                )}

                {cepLookup.address && formData.saved_latitude && formData.saved_longitude && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <div className="flex items-center gap-2 text-emerald-500 mb-1">
                      <CheckCircle2 size={16} />
                      <span className="text-sm font-medium">CEP validado com sucesso!</span>
                    </div>
                    <p className="text-xs text-gray-400 ml-6 mt-1">
                      {cepLookup.address}
                    </p>
                    <p className="text-xs text-gray-400 ml-6 mt-1">
                      Coordenadas: {formData.saved_latitude.toFixed(6)}, {formData.saved_longitude.toFixed(6)}
                    </p>
                  </div>
                )}

                <p className="text-xs text-gray-400">
                  Digite seu CEP para definir o ponto inicial do raio de busca. O CEP deve ser do estado do Paraná.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Raio de Busca: <span className="text-orange-500 font-bold">{formData.search_radius_km} km</span>
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={formData.search_radius_km}
              onChange={(e) => setFormData(prev => ({ ...prev, search_radius_km: Number(e.target.value) }))}
              className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-orange-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>1 km</span>
              <span>25 km</span>
              <span>50 km</span>
            </div>
          </div>

          <div className="border-t border-dark-600 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Package size={20} />
                  Produtos para Monitorar
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  {formData.product_ids.length} de {availableProducts.length} produtos selecionados
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  className="w-5 h-5 rounded border-dark-600 bg-dark-700 text-orange-600 focus:ring-2 focus:ring-orange-600"
                />
                <span className="text-sm font-medium text-gray-300">Selecionar Todos</span>
              </label>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
              <input
                type="text"
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-dark-700 border border-dark-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent placeholder-gray-500"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 bg-dark-700 rounded-lg p-4 border border-dark-600">
              {filteredProducts.length === 0 ? (
                <p className="text-center text-gray-400 py-4">Nenhum produto encontrado</p>
              ) : (
                filteredProducts.map(product => (
                  <label
                    key={product.id}
                    className="flex items-center gap-3 p-3 hover:bg-dark-600 rounded-lg cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={formData.product_ids.includes(product.id)}
                      onChange={() => handleProductToggle(product.id)}
                      className="w-4 h-4 rounded border-dark-500 bg-dark-800 text-orange-600 focus:ring-2 focus:ring-orange-600"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{product.name}</p>
                      {product.principle_active && (
                        <p className="text-xs text-gray-400">{product.principle_active}</p>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
            {errors.products && (
              <p className="text-red-500 text-sm mt-2">{errors.products}</p>
            )}
          </div>

          {errors.submit && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
              <p className="text-red-500 text-sm">{errors.submit}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-dark-600 bg-dark-800">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-6 py-3 text-gray-300 hover:bg-dark-700 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? 'Salvando...' : 'Salvar Perfil'}
          </button>
        </div>
      </div>
    </div>
  );
}
