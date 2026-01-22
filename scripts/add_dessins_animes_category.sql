-- Script SQL pour ajouter la catégorie "dessins-animes" en production
-- À exécuter sur la base de données production

-- Vérifier si la catégorie existe déjà
-- Si elle n'existe pas, l'insérer

INSERT INTO Category (id, name, icon, color)
SELECT 'dessins-animes', 'Dessins Animés', 'sparkles', '#ff6b9d'
WHERE NOT EXISTS (
    SELECT 1 FROM Category WHERE id = 'dessins-animes'
);

-- Vérifier le résultat
SELECT * FROM Category ORDER BY id;
