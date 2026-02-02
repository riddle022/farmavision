/*
  # Populate Common Products
  
  ## Description
  This migration populates the products table with commonly used medications in Brazil.
  Products are organized by medicine categories for easy filtering and management.
  
  ## Products Inserted
  - 50+ most common medications found in Brazilian pharmacies
  - Each product includes name, active ingredient, and category
  - Products commonly monitored by pharmacy owners
*/

-- Insert common products
INSERT INTO products (name, principle_active, medicine_category_id) VALUES
  -- Analgésicos (id: 1)
  ('Dipirona Sódica 500mg', 'Dipirona', 1),
  ('Paracetamol 750mg', 'Paracetamol', 1),
  ('Paracetamol 500mg', 'Paracetamol', 1),
  ('Aspirina 500mg', 'Ácido Acetilsalicílico', 1),
  ('Tylenol 750mg', 'Paracetamol', 1),
  ('Novalgina 500mg', 'Dipirona', 1),
  
  -- Antibióticos (id: 2)
  ('Amoxicilina 500mg', 'Amoxicilina', 2),
  ('Amoxicilina + Clavulanato 875mg', 'Amoxicilina + Clavulanato', 2),
  ('Azitromicina 500mg', 'Azitromicina', 2),
  ('Ciprofloxacino 500mg', 'Ciprofloxacino', 2),
  ('Cefalexina 500mg', 'Cefalexina', 2),
  ('Levofloxacino 500mg', 'Levofloxacino', 2),
  
  -- Anti-inflamatórios (id: 3)
  ('Ibuprofeno 600mg', 'Ibuprofeno', 3),
  ('Diclofenaco Sódico 50mg', 'Diclofenaco', 3),
  ('Nimesulida 100mg', 'Nimesulida', 3),
  ('Naproxeno 500mg', 'Naproxeno', 3),
  ('Cetoprofeno 100mg', 'Cetoprofeno', 3),
  
  -- Antiácidos (id: 4)
  ('Omeprazol 20mg', 'Omeprazol', 4),
  ('Omeprazol 40mg', 'Omeprazol', 4),
  ('Pantoprazol 40mg', 'Pantoprazol', 4),
  ('Esomeprazol 40mg', 'Esomeprazol', 4),
  ('Ranitidina 150mg', 'Ranitidina', 4),
  ('Lansoprazol 30mg', 'Lansoprazol', 4),
  
  -- Anti-hipertensivos (id: 5)
  ('Losartana Potássica 50mg', 'Losartana', 5),
  ('Enalapril 10mg', 'Enalapril', 5),
  ('Anlodipino 5mg', 'Anlodipino', 5),
  ('Hidroclorotiazida 25mg', 'Hidroclorotiazida', 5),
  ('Atenolol 50mg', 'Atenolol', 5),
  ('Valsartana 160mg', 'Valsartana', 5),
  
  -- Antidiabéticos (id: 6)
  ('Metformina 500mg', 'Metformina', 6),
  ('Metformina 850mg', 'Metformina', 6),
  ('Glibenclamida 5mg', 'Glibenclamida', 6),
  ('Gliclazida 30mg', 'Gliclazida', 6),
  ('Insulina NPH', 'Insulina', 6),
  
  -- Antialérgicos (id: 7)
  ('Loratadina 10mg', 'Loratadina', 7),
  ('Desloratadina 5mg', 'Desloratadina', 7),
  ('Cetirizina 10mg', 'Cetirizina', 7),
  ('Allegra 120mg', 'Fexofenadina', 7),
  ('Polaramine 2mg', 'Dexclorfeniramina', 7),
  
  -- Anticoagulantes (id: 8)
  ('Varfarina 5mg', 'Varfarina', 8),
  ('AAS 100mg', 'Ácido Acetilsalicílico', 8),
  ('Clopidogrel 75mg', 'Clopidogrel', 8),
  
  -- Antidepressivos (id: 9)
  ('Fluoxetina 20mg', 'Fluoxetina', 9),
  ('Sertralina 50mg', 'Sertralina', 9),
  ('Escitalopram 10mg', 'Escitalopram', 9),
  ('Amitriptilina 25mg', 'Amitriptilina', 9),
  
  -- Antivirais (id: 10)
  ('Aciclovir 400mg', 'Aciclovir', 10),
  ('Oseltamivir 75mg', 'Oseltamivir', 10),
  
  -- Vitaminas e Suplementos (id: 11)
  ('Vitamina C 1g', 'Ácido Ascórbico', 11),
  ('Vitamina D 2000UI', 'Colecalciferol', 11),
  ('Complexo B', 'Vitaminas do Complexo B', 11),
  ('Ácido Fólico 5mg', 'Ácido Fólico', 11),
  ('Sulfato Ferroso 40mg', 'Ferro', 11),
  
  -- Corticoides (id: 12)
  ('Prednisona 20mg', 'Prednisona', 12),
  ('Dexametasona 4mg', 'Dexametasona', 12),
  ('Betametasona', 'Betametasona', 12),
  
  -- Broncodilatadores (id: 13)
  ('Salbutamol 100mcg', 'Salbutamol', 13),
  ('Aerolin', 'Salbutamol', 13),
  ('Clenil', 'Beclometasona', 13),
  
  -- Contraceptivos (id: 14)
  ('Anticoncepcional Combinado', 'Etinilestradiol + Levonorgestrel', 14),
  ('Minipílula', 'Desogestrel', 14),
  
  -- Dermatológicos (id: 15)
  ('Minoxidil 5%', 'Minoxidil', 15),
  ('Ácido Retinoico', 'Tretinoína', 15),
  ('Hidrocortisona 1%', 'Hidrocortisona', 15)
ON CONFLICT (name) DO NOTHING;