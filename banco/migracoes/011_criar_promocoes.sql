
CREATE TABLE promocoes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(150) NOT NULL,
    descricao TEXT NULL,
    codigo VARCHAR(50) NULL UNIQUE,
    tipo_desconto ENUM('percentual', 'valor_fixo', 'informativo')
        NOT NULL DEFAULT 'informativo',
    valor_desconto DECIMAL(10, 2) NULL,
    inicio_em DATETIME(3) NULL,
    termina_em DATETIME(3) NULL,
    limite_usos INT UNSIGNED NULL,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),
    atualizado_em DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT chk_promocoes_valor
        CHECK (
            (tipo_desconto = 'informativo' AND valor_desconto IS NULL)
            OR
            (tipo_desconto = 'percentual'
                AND valor_desconto > 0
                AND valor_desconto <= 100)
            OR
            (tipo_desconto = 'valor_fixo'
                AND valor_desconto > 0)
        ),

    CONSTRAINT chk_promocoes_periodo
        CHECK (
            inicio_em IS NULL
            OR termina_em IS NULL
            OR termina_em > inicio_em
        ),

    INDEX idx_promocoes_ativa_periodo
        (ativa, inicio_em, termina_em)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
