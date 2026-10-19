
CREATE TABLE produtos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    categoria_id INT UNSIGNED NOT NULL,
    grupo_id INT UNSIGNED NULL,
    nome VARCHAR(150) NOT NULL,
    descricao TEXT NULL,
    preco DECIMAL(10, 2) NOT NULL,
    imagem_id INT UNSIGNED NULL,
    disponivel BOOLEAN NOT NULL DEFAULT TRUE,
    ordem SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    versao INT UNSIGNED NOT NULL DEFAULT 1,
    criado_em DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),
    atualizado_em DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT chk_produtos_preco
        CHECK (preco >= 0),

    CONSTRAINT fk_produtos_categoria
        FOREIGN KEY (categoria_id)
        REFERENCES categorias_cardapio(id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_produtos_grupo
        FOREIGN KEY (grupo_id)
        REFERENCES grupos_cardapio(id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    UNIQUE (id, categoria_id),

    INDEX idx_produtos_categoria_disponivel
        (categoria_id, disponivel),

    INDEX idx_produtos_grupo (grupo_id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
