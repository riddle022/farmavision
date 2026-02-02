/*
  # Add Own Price Column to Products Table

  ## Description
  This migration adds a new column `own_price` to the `products` table to store
  the user's pharmacy own pricing for each product. This price will be used as a
  baseline for comparing against competitor prices from the Menor Preço API.

  ## Changes Made
  
  1. New Column
    - `own_price` (numeric(10,2), nullable) - The user's own price for the product
    - Nullable to allow products without configured prices
    - Precision of 10,2 allows prices up to 99,999,999.99
    - Check constraint ensures non-negative values

  2. Index
    - Index on own_price for efficient queries filtering by price ranges

  ## Notes
  - Products can have NULL own_price initially
  - Users will configure prices through the Settings interface
  - The monitor will show warnings for products without own_price set
*/

-- Add own_price column to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'own_price'
  ) THEN
    ALTER TABLE products ADD COLUMN own_price NUMERIC(10, 2) CHECK (own_price >= 0);
  END IF;
END $$;

-- Create index for efficient price queries
CREATE INDEX IF NOT EXISTS idx_products_own_price ON products(own_price) WHERE own_price IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN products.own_price IS 'User pharmacy own price for this product, used for competitor price comparison';
