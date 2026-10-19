
CREATE TABLE metricas_diarias (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    data_referencia DATE NOT NULL UNIQUE,

    visitas_site INT UNSIGNED NOT NULL DEFAULT 0,

    visualizacoes_produtos INT UNSIGNED NOT NULL DEFAULT 0,

    cliques_ifood INT UNSIGNED NOT NULL DEFAULT 0,

    cliques_99food INT UNSIGNED NOT NULL DEFAULT 0,

    criado_em DATETIME(3)
        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    atualizado_em DATETIME(3)
        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT chk_metricas_nao_negativas CHECK (
        visitas_site >= 0
        AND visualizacoes_produtos >= 0
        AND cliques_ifood >= 0
        AND cliques_99food >= 0
    )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
