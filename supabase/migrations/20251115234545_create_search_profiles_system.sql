/*
  # Sistema de Perfis de Busca de Competidores

  1. Tabelas Criadas
    
    ## cities_parana
    - `id` (serial, primary key) - Identificador único da cidade
    - `name` (text, not null) - Nome da cidade
    - `latitude` (numeric, not null) - Latitude geográfica
    - `longitude` (numeric, not null) - Longitude geográfica
    - `created_at` (timestamptz) - Data de criação do registro
    
    ## search_profiles
    - `id` (uuid, primary key) - Identificador único do perfil
    - `user_id` (uuid, not null) - Referência ao usuário (auth.users)
    - `profile_name` (text, not null) - Nome descritivo do perfil
    - `is_active` (boolean, default false) - Indica se o perfil está ativo
    - `search_radius_km` (integer, not null) - Raio de busca em quilômetros
    - `location_type` (text, not null) - Tipo: 'auto' ou 'city'
    - `selected_city_id` (integer, nullable) - FK para cities_parana
    - `created_at` (timestamptz) - Data de criação
    - `updated_at` (timestamptz) - Data da última atualização
    
    ## search_profile_products
    - `id` (uuid, primary key) - Identificador único do relacionamento
    - `search_profile_id` (uuid, not null) - FK para search_profiles
    - `product_id` (integer, not null) - Referência ao produto
    - `created_at` (timestamptz) - Data de criação

  2. Segurança (RLS)
    - Habilitado RLS em todas as tabelas
    - Políticas restritivas por user_id para search_profiles
    - Políticas em cascata para search_profile_products
    - cities_parana é publicamente legível (somente leitura)
    
  3. Constraints e Índices
    - Constraint unique em (user_id, profile_name) para evitar nomes duplicados
    - Índice em search_profiles.user_id para consultas rápidas
    - Índice em search_profiles.is_active para filtros
    - Índice em search_profile_products para relacionamentos
    - Check constraint para location_type aceitar apenas 'auto' ou 'city'
    - Check constraint para search_radius_km entre 1 e 50km
    
  4. Triggers e Funções
    - Trigger para garantir apenas um perfil ativo por usuário
    - Função para atualizar updated_at automaticamente
    - Cascade delete para search_profile_products
*/

-- Criar tabela de cidades do Paraná
CREATE TABLE IF NOT EXISTS cities_parana (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela de perfis de busca
CREATE TABLE IF NOT EXISTS search_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  search_radius_km INTEGER NOT NULL,
  location_type TEXT NOT NULL CHECK (location_type IN ('auto', 'city')),
  selected_city_id INTEGER REFERENCES cities_parana(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_profile_name_per_user UNIQUE (user_id, profile_name),
  CONSTRAINT valid_search_radius CHECK (search_radius_km >= 1 AND search_radius_km <= 50)
);

-- Criar tabela de produtos associados aos perfis
CREATE TABLE IF NOT EXISTS search_profile_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_profile_id UUID NOT NULL REFERENCES search_profiles(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_profile_product UNIQUE (search_profile_id, product_id)
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_search_profiles_user_id ON search_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_search_profiles_is_active ON search_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_search_profile_products_profile_id ON search_profile_products(search_profile_id);
CREATE INDEX IF NOT EXISTS idx_cities_parana_name ON cities_parana(name);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_search_profiles_updated_at ON search_profiles;
CREATE TRIGGER update_search_profiles_updated_at
  BEFORE UPDATE ON search_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para garantir apenas um perfil ativo por usuário
CREATE OR REPLACE FUNCTION ensure_single_active_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = TRUE THEN
    UPDATE search_profiles
    SET is_active = FALSE
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para garantir perfil único ativo
DROP TRIGGER IF EXISTS ensure_single_active_profile_trigger ON search_profiles;
CREATE TRIGGER ensure_single_active_profile_trigger
  BEFORE INSERT OR UPDATE ON search_profiles
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_active_profile();

-- Habilitar RLS
ALTER TABLE cities_parana ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_profile_products ENABLE ROW LEVEL SECURITY;

-- Políticas para cities_parana (leitura pública)
CREATE POLICY "Anyone can read cities"
  ON cities_parana FOR SELECT
  TO authenticated
  USING (true);

-- Políticas para search_profiles
CREATE POLICY "Users can view own profiles"
  ON search_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own profiles"
  ON search_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profiles"
  ON search_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own profiles"
  ON search_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Políticas para search_profile_products
CREATE POLICY "Users can view own profile products"
  ON search_profile_products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM search_profiles
      WHERE search_profiles.id = search_profile_products.search_profile_id
      AND search_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own profile products"
  ON search_profile_products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM search_profiles
      WHERE search_profiles.id = search_profile_products.search_profile_id
      AND search_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own profile products"
  ON search_profile_products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM search_profiles
      WHERE search_profiles.id = search_profile_products.search_profile_id
      AND search_profiles.user_id = auth.uid()
    )
  );