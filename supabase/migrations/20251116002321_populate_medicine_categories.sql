/*
  # Populate Medicine Categories
  
  ## Description
  This migration populates the medicine_categories table with common pharmaceutical categories.
  These categories help organize and filter medications in the application.
  
  ## Categories Inserted
  - Common pharmaceutical categories used in Brazilian pharmacies
  - Each category includes a descriptive name and explanation
*/

-- Insert medicine categories
INSERT INTO medicine_categories (name, description) VALUES
  ('Analgésicos', 'Medicamentos para alívio de dor'),
  ('Antibióticos', 'Medicamentos para combater infecções bacterianas'),
  ('Anti-inflamatórios', 'Medicamentos para reduzir inflamação'),
  ('Antiácidos', 'Medicamentos para neutralizar acidez estomacal'),
  ('Anti-hipertensivos', 'Medicamentos para controle da pressão arterial'),
  ('Antidiabéticos', 'Medicamentos para controle do diabetes'),
  ('Antialérgicos', 'Medicamentos para alívio de alergias'),
  ('Anticoagulantes', 'Medicamentos para prevenir coagulação sanguínea'),
  ('Antidepressivos', 'Medicamentos para tratamento de depressão'),
  ('Antivirais', 'Medicamentos para combater infecções virais'),
  ('Vitaminas e Suplementos', 'Suplementos nutricionais e vitamínicos'),
  ('Corticoides', 'Medicamentos anti-inflamatórios hormonais'),
  ('Broncodilatadores', 'Medicamentos para problemas respiratórios'),
  ('Contraceptivos', 'Medicamentos para contracepção'),
  ('Dermatológicos', 'Medicamentos para tratamento de pele')
ON CONFLICT (name) DO NOTHING;