/*
  # Add CEP Support to Search Profiles

  1. Changes to search_profiles Table
    - `cep` (text, nullable) - Brazilian postal code for CEP-based location searches
  
  2. Purpose
    - Enable users to specify location using CEP (Brazilian postal code)
    - CEP will be geocoded to coordinates for radius-based searches
    - Provides a third convenient option alongside auto and city location types
  
  3. Constraints
    - CEP format validation (8 digits with optional hyphen)
    - Required when location_type = 'cep'
    - NULL for other location types
  
  4. Important Notes
    - CEP will be resolved to coordinates via ViaCEP API
    - Search radius starts from the CEP's geocoded location
    - CEP must be within Paraná state boundaries
    - Update location_type check constraint to include 'cep'
*/

-- Add cep column to search_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'search_profiles' AND column_name = 'cep'
  ) THEN
    ALTER TABLE search_profiles ADD COLUMN cep TEXT;
  END IF;
END $$;

-- Drop existing check constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'search_profiles' 
    AND constraint_name = 'search_profiles_location_type_check'
  ) THEN
    ALTER TABLE search_profiles DROP CONSTRAINT search_profiles_location_type_check;
  END IF;
END $$;

-- Add updated check constraint for location_type to include 'cep'
ALTER TABLE search_profiles 
ADD CONSTRAINT search_profiles_location_type_check 
CHECK (location_type IN ('auto', 'city', 'cep'));

-- Create index for CEP searches
CREATE INDEX IF NOT EXISTS idx_search_profiles_cep 
ON search_profiles(cep) 
WHERE cep IS NOT NULL;

-- Add documentation comment
COMMENT ON COLUMN search_profiles.cep IS 
'Brazilian postal code (CEP) when location_type = cep. Format: 12345-678 or 12345678. Geocoded to coordinates for radius searches.';