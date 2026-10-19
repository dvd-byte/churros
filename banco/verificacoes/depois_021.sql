-- Somente leitura: inventario e pendencias de revisao de conteudo.
SELECT table_name FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name;
SELECT table_name, constraint_name, constraint_type FROM information_schema.table_constraints
WHERE constraint_schema = DATABASE() ORDER BY table_name, constraint_type, constraint_name;

SELECT 'posts sem estrutura/categoria' AS pendencia, COUNT(*) AS quantidade
FROM posts_blog WHERE paragrafos_json IS NULL OR categoria IS NULL
UNION ALL
SELECT 'galeria sem alt', COUNT(*) FROM galeria WHERE texto_alternativo IS NULL OR TRIM(texto_alternativo) = ''
UNION ALL
SELECT 'promocoes sem plataforma', COUNT(*) FROM promocoes WHERE plataforma IS NULL
UNION ALL
SELECT 'produtos em rascunho', COUNT(*) FROM produtos WHERE status = 'rascunho'
UNION ALL
SELECT 'categorias com slug tecnico', COUNT(*) FROM categorias_cardapio WHERE slug = CONCAT('categoria-',id)
UNION ALL
SELECT 'resgates com fluxo legado', COUNT(*) FROM resgates WHERE status <> 'validado';
