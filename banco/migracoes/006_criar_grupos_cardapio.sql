
CREATE TABLE grupos_cardapio (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    categoria_id INT UNSIGNED NOT NULL,
    nome VARCHAR(100) NOT NULL,
    descricao VARCHAR(255) NULL,
    ordem TINYINT UNSIGNED NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),
    atualizado_em DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_grupos_categoria
        FOREIGN KEY (categoria_id)
        REFERENCES categorias_cardapio(id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    UNIQUE (categoria_id, nome)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
