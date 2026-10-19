ALTER TABLE categorias_cardapio
    MODIFY COLUMN ordem INT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN slug VARCHAR(160) NULL,
    ADD COLUMN imagem_id INT UNSIGNED NULL,
    ADD COLUMN alt VARCHAR(500) NULL,
    ADD COLUMN status ENUM('rascunho','publicado','inativo') NOT NULL DEFAULT 'rascunho',
    ADD COLUMN versao INT UNSIGNED NOT NULL DEFAULT 1,
    ADD CONSTRAINT chk_categorias_versao CHECK (versao > 0),
    ADD CONSTRAINT fk_categorias_imagem FOREIGN KEY (imagem_id)
        REFERENCES midias(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Identificadores tecnicos para registros legados: revisar antes de publicar URLs.
UPDATE categorias_cardapio
SET slug = CONCAT('categoria-', id), status = IF(ativa, 'publicado', 'inativo');
ALTER TABLE categorias_cardapio
    MODIFY COLUMN slug VARCHAR(160) NOT NULL,
    ADD UNIQUE KEY uq_categorias_slug (slug),
    ADD INDEX idx_categorias_status_ordem (status, ordem);

ALTER TABLE grupos_cardapio
    MODIFY COLUMN ordem INT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN versao INT UNSIGNED NOT NULL DEFAULT 1,
    ADD CONSTRAINT chk_grupos_versao CHECK (versao > 0),
    ADD UNIQUE KEY uq_grupos_id_categoria (id, categoria_id),
    ADD INDEX idx_grupos_categoria_ordem (categoria_id, ordem);

-- Categoria mantida para compatibilidade; API a deriva do grupo, nao do cliente.
-- Preflight precisa confirmar que todo produto tem grupo na mesma categoria.
ALTER TABLE produtos
    MODIFY COLUMN grupo_id INT UNSIGNED NOT NULL,
    MODIFY COLUMN ordem INT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN alt VARCHAR(500) NULL,
    ADD COLUMN destaque BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN status ENUM('rascunho','publicado','inativo') NOT NULL DEFAULT 'rascunho',
    ADD CONSTRAINT chk_produtos_versao CHECK (versao > 0),
    ADD CONSTRAINT fk_produtos_grupo_categoria FOREIGN KEY (grupo_id, categoria_id)
        REFERENCES grupos_cardapio(id, categoria_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD INDEX idx_produtos_publicacao_ordem (grupo_id, status, ordem),
    ADD INDEX idx_produtos_destaque (status, destaque, disponivel);

-- Produtos antigos ficam rascunho ate revisao: disponivel nao prova publicacao.
-- Nao alterar disponivel nem copiar texto alternativo automaticamente.
