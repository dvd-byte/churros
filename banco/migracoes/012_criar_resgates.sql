
CREATE TABLE resgates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    promocao_id INT UNSIGNED NOT NULL,

    identificador_hash CHAR(64)
        CHARACTER SET ascii
        COLLATE ascii_bin
        NOT NULL,

    status ENUM('solicitado', 'validado', 'cancelado')
        NOT NULL DEFAULT 'solicitado',

    criado_em DATETIME(3)
        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    atualizado_em DATETIME(3)
        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_resgates_promocao
        FOREIGN KEY (promocao_id)
        REFERENCES promocoes(id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT uq_resgates_promocao_identificador
        UNIQUE (promocao_id, identificador_hash),

    INDEX idx_resgates_promocao_status (promocao_id, status)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
