ALTER TABLE posts_blog
    MODIFY COLUMN resumo TEXT NULL,
    MODIFY COLUMN status ENUM('rascunho','publicado','arquivado','inativo') NOT NULL DEFAULT 'rascunho',
    ADD COLUMN categoria VARCHAR(100) NULL,
    ADD COLUMN paragrafos_json JSON NULL,
    ADD COLUMN alt VARCHAR(500) NULL,
    ADD COLUMN link VARCHAR(2048) NULL,
    ADD COLUMN texto_link VARCHAR(180) NULL,
    ADD COLUMN versao INT UNSIGNED NOT NULL DEFAULT 1,
    ADD CONSTRAINT chk_posts_versao CHECK (versao > 0),
    ADD CONSTRAINT chk_posts_paragrafos CHECK (paragrafos_json IS NULL OR JSON_TYPE(paragrafos_json) = 'ARRAY');

-- conteudo e slug existentes sao preservados. Conversao de HTML/texto antigo
-- em paragrafos deve ser revisada: a migracao nao inventa categoria ou conteudo.
ALTER TABLE galeria
    MODIFY COLUMN texto_alternativo VARCHAR(500) NULL,
    MODIFY COLUMN ordem INT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN legenda TEXT NULL,
    ADD COLUMN status ENUM('rascunho','publicado','inativo') NOT NULL DEFAULT 'rascunho',
    ADD COLUMN versao INT UNSIGNED NOT NULL DEFAULT 1,
    ADD CONSTRAINT chk_galeria_versao CHECK (versao > 0),
    ADD INDEX idx_galeria_status_ordem (status, ordem, id);

UPDATE galeria SET status = IF(publicada, 'publicado', 'inativo');
UPDATE galeria g JOIN midias m ON m.id = g.midia_id
SET g.legenda = m.texto_legenda
WHERE g.legenda IS NULL AND m.texto_legenda IS NOT NULL;
