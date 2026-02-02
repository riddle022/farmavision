/*
  # Agregar Coordenadas Guardadas a Perfiles de Búsqueda

  1. Cambios en la Tabla search_profiles
    - `saved_latitude` (numeric, nullable) - Latitud guardada para localización automática
    - `saved_longitude` (numeric, nullable) - Longitud guardada para localización automática
    - `location_updated_at` (timestamptz, nullable) - Fecha de última actualización de ubicación
  
  2. Propósito
    - Almacenar coordenadas obtenidas cuando el usuario configura localización automática
    - Evitar pedir permisos de geolocalización en cada carga de página
    - Mejorar rendimiento y experiencia de usuario
    - Permitir actualización manual de ubicación cuando sea necesario
  
  3. Notas Importantes
    - Para perfiles con location_type = 'auto', estas coordenadas son obligatorias
    - Para perfiles con location_type = 'city', estas columnas quedan NULL
    - El usuario puede actualizar estas coordenadas desde la interfaz
    - Se recomienda actualizar la ubicación si el usuario se muda de lugar
*/

-- Agregar columnas de coordenadas guardadas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'search_profiles' AND column_name = 'saved_latitude'
  ) THEN
    ALTER TABLE search_profiles ADD COLUMN saved_latitude NUMERIC(10, 7);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'search_profiles' AND column_name = 'saved_longitude'
  ) THEN
    ALTER TABLE search_profiles ADD COLUMN saved_longitude NUMERIC(10, 7);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'search_profiles' AND column_name = 'location_updated_at'
  ) THEN
    ALTER TABLE search_profiles ADD COLUMN location_updated_at TIMESTAMPTZ;
  END IF;
END $$;

-- Crear índice para búsquedas por coordenadas guardadas
CREATE INDEX IF NOT EXISTS idx_search_profiles_saved_coords 
ON search_profiles(saved_latitude, saved_longitude) 
WHERE saved_latitude IS NOT NULL AND saved_longitude IS NOT NULL;

-- Comentarios de documentación
COMMENT ON COLUMN search_profiles.saved_latitude IS 
'Latitud guardada cuando location_type = auto. Obtenida al configurar el perfil.';

COMMENT ON COLUMN search_profiles.saved_longitude IS 
'Longitud guardada cuando location_type = auto. Obtenida al configurar el perfil.';

COMMENT ON COLUMN search_profiles.location_updated_at IS 
'Fecha de última actualización de las coordenadas guardadas. Útil para recordar al usuario actualizar si es muy antigua.';