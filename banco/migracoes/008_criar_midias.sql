
CREATE TABLE midias (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nome_arquivo VARCHAR(255) NOT NULL,
    caminho_arquivo VARCHAR(500) NOT NULL UNIQUE,
    tipo_mime VARCHAR(100) NOT NULL,
    tamanho_bytes INT UNSIGNED NOT NULL,
    texto_alternativo VARCHAR(255) NULL,
    texto_legenda VARCHAR(255) NULL,
    largura_px SMALLINT UNSIGNED NULL,
    altura_px SMALLINT UNSIGNED NULL,
    criado_em DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT chk_midias_tipo_mime
        CHECK (
            tipo_mime IN (
                'image/jpeg',
                'image/png',
                'image/webp',
                'image/avif'
            )
        )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
