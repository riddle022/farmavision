/*
  # Create Core Application Tables
  
  ## Overview
  This migration creates all the core tables needed for the price monitoring application.
  
  ## 1. New Tables Created
  
  ### medicine_categories
  - `id` (serial, primary key) - Unique identifier
  - `name` (text, not null) - Category name (e.g., "Analgésicos", "Antibióticos")
  - `description` (text, nullable) - Detailed description of the category
  - `icon_url` (text, nullable) - URL for category icon/image
  - `created_at` (timestamptz) - Timestamp of creation
  - `updated_at` (timestamptz) - Timestamp of last update
  
  ### products
  - `id` (serial, primary key) - Unique identifier
  - `external_id` (text, nullable) - External API reference ID
  - `name` (text, not null) - Product name (e.g., "Dipirona Sódica 500mg")
  - `description` (text, nullable) - Product description
  - `sku` (text, nullable) - Stock keeping unit
  - `medicine_category_id` (integer, nullable) - FK to medicine_categories
  - `principle_active` (text, nullable) - Active pharmaceutical ingredient
  - `created_at` (timestamptz) - Timestamp of creation
  - `updated_at` (timestamptz) - Timestamp of last update
  
  ### user_profiles
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, not null) - FK to auth.users
  - `pharmacy_name` (text, nullable) - User's pharmacy name
  - `cnpj` (text, nullable) - Brazilian tax ID
  - `phone` (text, nullable) - Contact phone
  - `address` (text, nullable) - Full address
  - `latitude` (numeric, nullable) - Geographical latitude
  - `longitude` (numeric, nullable) - Geographical longitude
  - `created_at` (timestamptz) - Timestamp of creation
  - `updated_at` (timestamptz) - Timestamp of last update
  
  ### pharmacies
  - `id` (serial, primary key) - Unique identifier
  - `user_id` (uuid, not null) - FK to auth.users (who tracked this competitor)
  - `name` (text, not null) - Pharmacy name
  - `cnpj` (text, nullable) - Brazilian tax ID
  - `latitude` (numeric, nullable) - Geographical latitude
  - `longitude` (numeric, nullable) - Geographical longitude
  - `address` (text, nullable) - Full address
  - `phone` (text, nullable) - Contact phone
  - `is_own_pharmacy` (boolean, default false) - Whether this is user's own pharmacy
  - `agression_score` (numeric, default 0) - Competitiveness metric
  - `competitiveness_rank` (integer, nullable) - Ranking among competitors
  - `created_at` (timestamptz) - Timestamp of creation
  - `updated_at` (timestamptz) - Timestamp of last update
  
  ### price_history
  - `id` (bigserial, primary key) - Unique identifier
  - `pharmacy_id` (integer, not null) - FK to pharmacies
  - `product_id` (integer, not null) - FK to products
  - `price` (numeric, not null) - Price value
  - `collected_at` (timestamptz, not null) - When price was collected
  - `source` (text, not null) - Data source (e.g., "menor_preco_api", "manual")
  - `is_available` (boolean, default true) - Product availability
  - `created_at` (timestamptz) - Timestamp of creation
  
  ### price_alerts
  - `id` (serial, primary key) - Unique identifier
  - `user_id` (uuid, not null) - FK to auth.users
  - `product_id` (integer, not null) - FK to products
  - `alert_type` (text, not null) - Type: 'price_drop', 'price_increase', 'competitor_change'
  - `threshold` (numeric, nullable) - Threshold value for alert
  - `is_active` (boolean, default true) - Whether alert is active
  - `notification_channels` (jsonb, default '[]') - Array of channels: ["email", "push"]
  - `created_at` (timestamptz) - Timestamp of creation
  - `updated_at` (timestamptz) - Timestamp of last update
  
  ### dashboard_snapshots
  - `id` (serial, primary key) - Unique identifier
  - `user_id` (uuid, not null) - FK to auth.users
  - `snapshot_date` (date, not null) - Date of snapshot
  - `total_products_monitored` (integer, nullable) - Total products tracked
  - `total_competitors` (integer, nullable) - Total competitors tracked
  - `most_volatile_product` (text, nullable) - Product with most price changes
  - `top_competitor` (text, nullable) - Most aggressive competitor
  - `avg_margin_change` (numeric, nullable) - Average margin change percentage
  - `created_at` (timestamptz) - Timestamp of creation
  
  ## 2. Security (RLS)
  - All tables have RLS enabled
  - User-specific data is protected by user_id checks
  - Public reference data (categories, products) is readable by authenticated users
  - Price history is only visible for user's tracked pharmacies
  
  ## 3. Indexes
  - Foreign key indexes for optimal query performance
  - Timestamp indexes for time-series queries
  - Composite indexes for common query patterns
  
  ## 4. Constraints
  - Unique constraints to prevent duplicates
  - Check constraints for data validation
  - NOT NULL constraints for required fields
*/

-- Create medicine_categories table
CREATE TABLE IF NOT EXISTS medicine_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  external_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  medicine_category_id INTEGER REFERENCES medicine_categories(id) ON DELETE SET NULL,
  principle_active TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_product_name UNIQUE (name)
);

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  pharmacy_name TEXT,
  cnpj TEXT,
  phone TEXT,
  address TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create pharmacies table
CREATE TABLE IF NOT EXISTS pharmacies (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cnpj TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  address TEXT,
  phone TEXT,
  is_own_pharmacy BOOLEAN DEFAULT FALSE,
  agression_score NUMERIC(5, 2) DEFAULT 0,
  competitiveness_rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create price_history table
CREATE TABLE IF NOT EXISTS price_history (
  id BIGSERIAL PRIMARY KEY,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create price_alerts table
CREATE TABLE IF NOT EXISTS price_alerts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('price_drop', 'price_increase', 'competitor_change')),
  threshold NUMERIC(10, 2),
  is_active BOOLEAN DEFAULT TRUE,
  notification_channels JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create dashboard_snapshots table
CREATE TABLE IF NOT EXISTS dashboard_snapshots (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_products_monitored INTEGER,
  total_competitors INTEGER,
  most_volatile_product TEXT,
  top_competitor TEXT,
  avg_margin_change NUMERIC(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_snapshot_per_user_date UNIQUE (user_id, snapshot_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(medicine_category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_principle_active ON products(principle_active);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_pharmacies_user_id ON pharmacies(user_id);
CREATE INDEX IF NOT EXISTS idx_pharmacies_location ON pharmacies(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_price_history_pharmacy_id ON price_history(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_collected_at ON price_history(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_pharmacy_product ON price_history(pharmacy_id, product_id, collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_alerts_user_id ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_product_id ON price_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_user_id ON dashboard_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_date ON dashboard_snapshots(snapshot_date DESC);

-- Add updated_at triggers
CREATE TRIGGER update_medicine_categories_updated_at
  BEFORE UPDATE ON medicine_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pharmacies_updated_at
  BEFORE UPDATE ON pharmacies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_price_alerts_updated_at
  BEFORE UPDATE ON price_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE medicine_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for medicine_categories (public read)
CREATE POLICY "Anyone can read medicine categories"
  ON medicine_categories FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for products (public read)
CREATE POLICY "Anyone can read products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for pharmacies
CREATE POLICY "Users can view own pharmacies"
  ON pharmacies FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own pharmacies"
  ON pharmacies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pharmacies"
  ON pharmacies FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pharmacies"
  ON pharmacies FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for price_history
CREATE POLICY "Users can view price history for own pharmacies"
  ON price_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pharmacies
      WHERE pharmacies.id = price_history.pharmacy_id
      AND pharmacies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert price history for own pharmacies"
  ON price_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pharmacies
      WHERE pharmacies.id = price_history.pharmacy_id
      AND pharmacies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete price history for own pharmacies"
  ON price_history FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pharmacies
      WHERE pharmacies.id = price_history.pharmacy_id
      AND pharmacies.user_id = auth.uid()
    )
  );

-- RLS Policies for price_alerts
CREATE POLICY "Users can view own alerts"
  ON price_alerts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own alerts"
  ON price_alerts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts"
  ON price_alerts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts"
  ON price_alerts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for dashboard_snapshots
CREATE POLICY "Users can view own snapshots"
  ON dashboard_snapshots FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own snapshots"
  ON dashboard_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own snapshots"
  ON dashboard_snapshots FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);