
CREATE TABLE galeria (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    midia_id INT UNSIGNED NOT NULL,
    titulo VARCHAR(150) NULL,
    texto_alternativo VARCHAR(255) NULL,
    ordem SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    publicada BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),
    atualizado_em DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_galeria_midia
        FOREIGN KEY (midia_id)
        REFERENCES midias(id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    INDEX idx_galeria_publicada_ordem
        (publicada, ordem)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
