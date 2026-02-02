import { useState, useEffect } from 'react';
import { X, Save, DollarSign, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Product } from '../types';

interface ProductPriceManagerProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  profileName: string;
}

interface ProductWithPrice extends Product {
  tempPrice: string;
  hasChanges: boolean;
}

export default function ProductPriceManager({
  isOpen,
  onClose,
  profileId,
  profileName
}: ProductPriceManagerProps) {
  const [products, setProducts] = useState<ProductWithPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen, profileId]);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: productIds, error: productIdsError } = await supabase
        .from('search_profile_products')
        .select('product_id')
        .eq('search_profile_id', profileId);

      if (productIdsError) throw productIdsError;

      if (!productIds || productIds.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds.map(p => p.product_id))
        .order('name');

      if (productsError) throw productsError;

      const productsWithTemp = (productsData || []).map(p => ({
        ...p,
        tempPrice: p.own_price?.toFixed(2) || '',
        hasChanges: false
      }));

      setProducts(productsWithTemp);
    } catch (err) {
      console.error('Error loading products:', err);
      setError('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (productId: number, value: string) => {
    const cleanValue = value.replace(/[^\d.,]/g, '').replace(',', '.');

    setProducts(prev =>
      prev.map(p => {
        if (p.id === productId) {
          const originalPrice = p.own_price?.toFixed(2) || '';
          return {
            ...p,
            tempPrice: cleanValue,
            hasChanges: cleanValue !== originalPrice
          };
        }
        return p;
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updates = products
        .filter(p => p.hasChanges)
        .map(p => ({
          id: p.id,
          own_price: p.tempPrice ? parseFloat(p.tempPrice) : null
        }));

      if (updates.length === 0) {
        onClose();
        return;
      }

      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ own_price: update.own_price })
          .eq('id', update.id);

        if (updateError) throw updateError;
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error saving prices:', err);
      setError('Erro ao salvar preços');
    } finally {
      setSaving(false);
    }
  };

  const hasAnyChanges = products.some(p => p.hasChanges);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-xl border border-dark-600 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-dark-600">
          <div>
            <h2 className="text-xl font-bold text-white">Gerenciar Preços</h2>
            <p className="text-sm text-gray-400 mt-1">Perfil: {profileName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-orange-600" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle size={48} className="text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">Nenhum produto neste perfil</p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map(product => (
                <div
                  key={product.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                    product.hasChanges
                      ? 'bg-orange-500/5 border-orange-600'
                      : 'bg-dark-700 border-dark-600'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{product.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {product.principle_active || 'Sem princípio ativo'}
                    </p>
                  </div>

                  <div className="relative w-32">
                    <DollarSign
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                    <input
                      type="text"
                      value={product.tempPrice}
                      onChange={(e) => handlePriceChange(product.id, e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 py-2 bg-dark-800 border border-dark-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent text-right"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="px-6 py-3 bg-red-500/10 border-t border-red-600/20">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="px-6 py-3 bg-emerald-500/10 border-t border-emerald-600/20">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={16} />
              <span className="text-sm">Preços salvos com sucesso!</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 p-6 border-t border-dark-600">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasAnyChanges || loading}
            className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save size={18} />
                Salvar Preços
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
