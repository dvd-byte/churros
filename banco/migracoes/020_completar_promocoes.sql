-- Campo codigo legado preservado. Nao presumir a plataforma de um codigo.
-- Novas campanhas usam codigo_ifood/codigo_99; codigo legado permanece NULL.
ALTER TABLE promocoes
    MODIFY COLUMN titulo VARCHAR(200) NOT NULL,
    ADD COLUMN plataforma ENUM('ifood','99food','ambas') NULL,
    ADD COLUMN codigo_ifood VARCHAR(255) NULL,
    ADD COLUMN codigo_99 VARCHAR(255) NULL,
    ADD COLUMN condicoes TEXT NULL,
    ADD COLUMN status ENUM('rascunho','ativo','inativo') NOT NULL DEFAULT 'rascunho',
    ADD COLUMN arquivada_em DATETIME(3) NULL,
    ADD COLUMN versao INT UNSIGNED NOT NULL DEFAULT 1,
    ADD CONSTRAINT chk_promocoes_versao CHECK (versao > 0),
    ADD CONSTRAINT chk_promocoes_ativacao CHECK (
        status <> 'ativo' OR (
            arquivada_em IS NULL
            AND plataforma IS NOT NULL
            AND inicio_em IS NOT NULL AND termina_em IS NOT NULL
            AND termina_em > inicio_em
            AND condicoes IS NOT NULL AND CHAR_LENGTH(TRIM(condicoes)) > 0
            AND (plataforma NOT IN ('ifood','ambas')
                OR (codigo_ifood IS NOT NULL AND CHAR_LENGTH(TRIM(codigo_ifood)) > 0))
            AND (plataforma NOT IN ('99food','ambas')
                OR (codigo_99 IS NOT NULL AND CHAR_LENGTH(TRIM(codigo_99)) > 0))
        )
    ),
    ADD INDEX idx_promocoes_status_periodo (status, arquivada_em, inicio_em, termina_em);

-- Resgates e seus estados nao sao reclassificados, nem a coleta de CPF ativada.
ALTER TABLE resgates ADD INDEX idx_resgates_data (criado_em);

-- detalhe livre nao recebe novos payloads pela API; coluna mantida para historico.
-- Nao copiar CPF, tokens ou codigos para auditoria_admin.detalhes.
