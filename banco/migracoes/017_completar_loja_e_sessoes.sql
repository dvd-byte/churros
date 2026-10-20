-- MariaDB: aplicar uma vez, depois de 016 e verificacoes/antes_017.sql.
-- Backup obrigatorio em base existente. DDL nao tem rollback global.
ALTER TABLE sessoes_admin
    ADD COLUMN csrf_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    ADD CONSTRAINT chk_sessao_expiracao CHECK (expira_em > criado_em);

ALTER TABLE loja
    MODIFY COLUMN endereco TEXT NULL,
    MODIFY COLUMN link_ifood VARCHAR(2048) NULL,
    MODIFY COLUMN link_99food VARCHAR(2048) NULL,
    MODIFY COLUMN instagram_url VARCHAR(2048) NULL,
    ADD COLUMN whatsapp_url VARCHAR(2048) NULL,
    ADD COLUMN mapa_url TEXT NULL,
    ADD COLUMN historia_json JSON NULL,
    ADD COLUMN imagem_sobre_id INT UNSIGNED NULL,
    ADD COLUMN alt_sobre VARCHAR(500) NULL,
    ADD COLUMN fuso VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
    ADD COLUMN versao INT UNSIGNED NOT NULL DEFAULT 1,
    ADD COLUMN loja_unica TINYINT UNSIGNED NOT NULL DEFAULT 1,
    ADD CONSTRAINT chk_loja_unica CHECK (loja_unica = 1),
    ADD CONSTRAINT uq_loja_unica UNIQUE (loja_unica),
    ADD CONSTRAINT chk_loja_historia CHECK (historia_json IS NULL OR JSON_TYPE(historia_json) = 'ARRAY'),
    ADD CONSTRAINT chk_loja_versao CHECK (versao > 0),
    ADD CONSTRAINT fk_loja_imagem_sobre FOREIGN KEY (imagem_sobre_id)
        REFERENCES midias(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Mantida a numeracao 1..7. Convencao da API: segunda=1, domingo=7.
-- Nao convertemos dias legados sem confirmar a convencao usada na importacao.
ALTER TABLE horarios_semanais
    ADD COLUMN loja_id TINYINT UNSIGNED NOT NULL DEFAULT 1,
    ADD CONSTRAINT fk_horarios_loja FOREIGN KEY (loja_id)
        REFERENCES loja(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT chk_horarios_intervalo CHECK (
        (fechado = TRUE AND hora_abertura IS NULL AND hora_fechamento IS NULL)
        OR (fechado = FALSE AND hora_abertura IS NOT NULL AND hora_fechamento IS NOT NULL
            AND hora_abertura >= '00:00:00' AND hora_fechamento < '24:00:00'
            AND hora_fechamento > hora_abertura)
    );

ALTER TABLE midias
    ADD COLUMN criado_por INT UNSIGNED NULL,
    ADD CONSTRAINT fk_midias_administrador FOREIGN KEY (criado_por)
        REFERENCES administradores(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
