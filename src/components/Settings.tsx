import { useState, useEffect } from 'react';
import { Plus, MapPin, Radar, Package, Power, Edit2, Trash2, Copy, CheckCircle2, Loader2, AlertCircle, DollarSign, RefreshCcw, Hash } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SearchProfileWithDetails, CityParana, Product } from '../types';
import ProfileModal, { ProfileFormData } from './ProfileModal';
import ProductPriceManager from './ProductPriceManager';
import { useGeolocation } from '../hooks/useGeolocation';

export default function Settings() {
  const [profiles, setProfiles] = useState<SearchProfileWithDetails[]>([]);
  const [cities, setCities] = useState<CityParana[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<SearchProfileWithDetails | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [isPriceManagerOpen, setIsPriceManagerOpen] = useState(false);
  const [selectedProfileForPrices, setSelectedProfileForPrices] = useState<SearchProfileWithDetails | null>(null);
  const [updatingLocationId, setUpdatingLocationId] = useState<string | null>(null);

  const geolocation = useGeolocation(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadProfiles(),
        loadCities(),
        loadProducts()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      showToast('Erro ao carregar dados', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadProfiles = async () => {
    const { data: profilesData, error: profilesError } = await supabase
      .from('search_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) throw profilesError;

    const profilesWithDetails = await Promise.all(
      (profilesData || []).map(async (profile) => {
        const { count } = await supabase
          .from('search_profile_products')
          .select('*', { count: 'exact', head: true })
          .eq('search_profile_id', profile.id);

        let selectedCity = null;
        if (profile.selected_city_id) {
          const { data: cityData } = await supabase
            .from('cities_parana')
            .select('*')
            .eq('id', profile.selected_city_id)
            .single();
          selectedCity = cityData;
        }

        return {
          ...profile,
          product_count: count || 0,
          selected_city: selectedCity
        };
      })
    );

    setProfiles(profilesWithDetails);
  };

  const loadCities = async () => {
    const { data, error } = await supabase
      .from('cities_parana')
      .select('*')
      .order('name');

    if (error) throw error;
    setCities(data || []);
  };

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading products:', error);
      throw error;
    }

    setProducts(data || []);
  };

  const handleSaveProfile = async (formData: ProfileFormData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (editingProfile) {
        const { error: updateError } = await supabase
          .from('search_profiles')
          .update({
            profile_name: formData.profile_name,
            location_type: formData.location_type,
            selected_city_id: formData.selected_city_id,
            cep: formData.cep,
            search_radius_km: formData.search_radius_km,
            saved_latitude: formData.saved_latitude,
            saved_longitude: formData.saved_longitude,
            location_updated_at: formData.saved_latitude && formData.saved_longitude ? new Date().toISOString() : null
          })
          .eq('id', editingProfile.id);

        if (updateError) throw updateError;

        const { error: deleteProductsError } = await supabase
          .from('search_profile_products')
          .delete()
          .eq('search_profile_id', editingProfile.id);

        if (deleteProductsError) throw deleteProductsError;

        const productInserts = formData.product_ids.map(productId => ({
          search_profile_id: editingProfile.id,
          product_id: productId
        }));

        if (productInserts.length > 0) {
          const { error: insertProductsError } = await supabase
            .from('search_profile_products')
            .insert(productInserts);

          if (insertProductsError) throw insertProductsError;
        }

        showToast('Perfil atualizado com sucesso!', 'success');
      } else {
        const { data: newProfile, error: insertError } = await supabase
          .from('search_profiles')
          .insert({
            user_id: user.id,
            profile_name: formData.profile_name,
            location_type: formData.location_type,
            selected_city_id: formData.selected_city_id,
            cep: formData.cep,
            search_radius_km: formData.search_radius_km,
            is_active: false,
            saved_latitude: formData.saved_latitude,
            saved_longitude: formData.saved_longitude,
            location_updated_at: formData.saved_latitude && formData.saved_longitude ? new Date().toISOString() : null
          })
          .select()
          .single();

        if (insertError) throw insertError;

        const productInserts = formData.product_ids.map(productId => ({
          search_profile_id: newProfile.id,
          product_id: productId
        }));

        if (productInserts.length > 0) {
          const { error: insertProductsError } = await supabase
            .from('search_profile_products')
            .insert(productInserts);

          if (insertProductsError) throw insertProductsError;
        }

        showToast('Perfil criado com sucesso!', 'success');
      }

      await loadProfiles();
      setIsModalOpen(false);
      setEditingProfile(null);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      if (error.message?.includes('unique_profile_name_per_user')) {
        showToast('Já existe um perfil com este nome', 'error');
      } else {
        showToast('Erro ao salvar perfil', 'error');
      }
      throw error;
    }
  };

  const handleActivateProfile = async (profileId: string) => {
    setActivatingId(profileId);
    try {
      const { error } = await supabase
        .from('search_profiles')
        .update({ is_active: true })
        .eq('id', profileId);

      if (error) throw error;

      await loadProfiles();
      showToast('Perfil ativado com sucesso!', 'success');
    } catch (error) {
      console.error('Error activating profile:', error);
      showToast('Erro ao ativar perfil', 'error');
    } finally {
      setActivatingId(null);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Tem certeza que deseja excluir este perfil? Esta ação não pode ser desfeita.')) {
      return;
    }

    setDeletingId(profileId);
    try {
      const { error } = await supabase
        .from('search_profiles')
        .delete()
        .eq('id', profileId);

      if (error) throw error;

      await loadProfiles();
      showToast('Perfil excluído com sucesso!', 'success');
    } catch (error) {
      console.error('Error deleting profile:', error);
      showToast('Erro ao excluir perfil', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicateProfile = async (profile: SearchProfileWithDetails) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: productIds } = await supabase
        .from('search_profile_products')
        .select('product_id')
        .eq('search_profile_id', profile.id);

      const newProfileName = `${profile.profile_name} (Cópia)`;

      await handleSaveProfile({
        profile_name: newProfileName,
        location_type: profile.location_type,
        selected_city_id: profile.selected_city_id,
        search_radius_km: profile.search_radius_km,
        product_ids: productIds?.map(p => p.product_id) || []
      });

      showToast('Perfil duplicado com sucesso!', 'success');
    } catch (error) {
      console.error('Error duplicating profile:', error);
      showToast('Erro ao duplicar perfil', 'error');
    }
  };

  const handleEditProfile = async (profile: SearchProfileWithDetails) => {
    try {
      const { data: productIds, error } = await supabase
        .from('search_profile_products')
        .select('product_id')
        .eq('search_profile_id', profile.id);

      if (error) throw error;

      setEditingProfile({
        ...profile,
        products: products.filter(p => productIds?.some(pi => pi.product_id === p.id))
      });
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error loading profile products:', error);
      showToast('Erro ao carregar produtos do perfil', 'error');
    }
  };

  const handleUpdateLocation = async (profileId: string) => {
    setUpdatingLocationId(profileId);
    try {
      geolocation.refetch();

      await new Promise<void>((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (geolocation.latitude && geolocation.longitude) {
            clearInterval(checkInterval);
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

      const { error } = await supabase
        .from('search_profiles')
        .update({
          saved_latitude: geolocation.latitude,
          saved_longitude: geolocation.longitude,
          location_updated_at: new Date().toISOString()
        })
        .eq('id', profileId);

      if (error) throw error;

      await loadProfiles();
      showToast('Localização atualizada com sucesso!', 'success');
    } catch (error: any) {
      console.error('Error updating location:', error);
      showToast(error.message || 'Erro ao atualizar localização', 'error');
    } finally {
      setUpdatingLocationId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={48} className="animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Configurações</h2>
          <p className="text-gray-400">Gerencie seus perfis de busca de competidores</p>
        </div>
        <button
          onClick={() => {
            setEditingProfile(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors shadow-lg hover:shadow-xl"
        >
          <Plus size={20} />
          Novo Perfil
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className="bg-dark-800 rounded-xl border border-dark-600 p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-orange-600/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin size={40} className="text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Nenhum perfil de busca cadastrado
            </h3>
            <p className="text-gray-400 mb-6">
              Crie seu primeiro perfil para começar a monitorar preços de competidores
            </p>
            <button
              onClick={() => {
                setEditingProfile(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
            >
              <Plus size={20} />
              Criar Primeiro Perfil
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className={`bg-dark-800 rounded-xl border-2 ${
                profile.is_active ? 'border-orange-600' : 'border-dark-600'
              } p-6 hover:shadow-xl transition-all relative`}
            >
              {profile.is_active && (
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full">
                    <Power size={12} />
                    Ativo
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-white mb-3">{profile.profile_name}</h3>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-300">
                    {profile.location_type === 'auto' ? (
                      <>
                        <Radar size={16} className="text-orange-500" />
                        <span className="text-sm">Localização Automática</span>
                      </>
                    ) : profile.location_type === 'cep' ? (
                      <>
                        <Hash size={16} className="text-orange-500" />
                        <span className="text-sm">CEP: {profile.cep || 'Não informado'}</span>
                      </>
                    ) : (
                      <>
                        <MapPin size={16} className="text-orange-500" />
                        <span className="text-sm">{profile.selected_city?.name || 'Cidade não selecionada'}</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-gray-300">
                    <Radar size={16} className="text-orange-500" />
                    <span className="text-sm">Raio de {profile.search_radius_km} km</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-300">
                    <Package size={16} className="text-orange-500" />
                    <span className="text-sm">{profile.product_count} produtos</span>
                  </div>

                  {(profile.location_type === 'auto' || profile.location_type === 'cep') && profile.saved_latitude && profile.saved_longitude && (
                    <div className="mt-3 p-2 rounded-lg bg-dark-700 border border-dark-600">
                      <p className="text-xs text-gray-400">
                        Localização: {profile.saved_latitude.toFixed(4)}, {profile.saved_longitude.toFixed(4)}
                      </p>
                      {profile.location_updated_at && (
                        <p className="text-xs text-gray-500 mt-1">
                          Atualizada em {new Date(profile.location_updated_at).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-dark-600">
                <div className="flex items-center gap-2">
                  {!profile.is_active && (
                    <button
                      onClick={() => handleActivateProfile(profile.id)}
                      disabled={activatingId === profile.id}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50"
                    >
                      {activatingId === profile.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Power size={16} />
                      )}
                      Ativar
                    </button>
                  )}

                  {profile.is_active && (
                    <button
                      disabled
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg font-medium opacity-75 cursor-not-allowed"
                    >
                      <CheckCircle2 size={16} />
                      Ativo
                    </button>
                  )}

                  <button
                    onClick={() => handleEditProfile(profile)}
                    className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={18} className="text-gray-400 hover:text-white" />
                  </button>

                  <button
                    onClick={() => handleDuplicateProfile(profile)}
                    className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                    title="Duplicar"
                  >
                    <Copy size={18} className="text-gray-400 hover:text-white" />
                  </button>

                  <button
                    onClick={() => handleDeleteProfile(profile.id)}
                    disabled={deletingId === profile.id}
                    className="p-2 hover:bg-dark-700 rounded-lg transition-colors disabled:opacity-50"
                    title="Excluir"
                  >
                    {deletingId === profile.id ? (
                      <Loader2 size={18} className="animate-spin text-gray-400" />
                    ) : (
                      <Trash2 size={18} className="text-gray-400 hover:text-red-500" />
                    )}
                  </button>
                </div>

                {profile.location_type === 'auto' && (
                  <button
                    onClick={() => handleUpdateLocation(profile.id)}
                    disabled={updatingLocationId === profile.id}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-dark-700 border border-dark-600 text-gray-300 rounded-lg hover:bg-dark-600 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {updatingLocationId === profile.id ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Atualizando...
                      </>
                    ) : (
                      <>
                        <RefreshCcw size={16} />
                        Atualizar Localização
                      </>
                    )}
                  </button>
                )}

                {profile.product_count > 0 && (
                  <button
                    onClick={() => {
                      setSelectedProfileForPrices(profile);
                      setIsPriceManagerOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-dark-700 border border-dark-600 text-gray-300 rounded-lg hover:bg-dark-600 hover:text-white transition-colors"
                  >
                    <DollarSign size={16} />
                    Gerenciar Preços
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ProfileModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProfile(null);
        }}
        onSave={handleSaveProfile}
        editingProfile={editingProfile}
        cities={cities}
        availableProducts={products}
      />

      {selectedProfileForPrices && (
        <ProductPriceManager
          isOpen={isPriceManagerOpen}
          onClose={() => {
            setIsPriceManagerOpen(false);
            setSelectedProfileForPrices(null);
          }}
          profileId={selectedProfileForPrices.id}
          profileName={selectedProfileForPrices.profile_name}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className={`px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle2 size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
