
CREATE TABLE posts_blog (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    slug VARCHAR(220) NOT NULL UNIQUE,
    resumo VARCHAR(500) NULL,
    conteudo MEDIUMTEXT NOT NULL,
    imagem_id INT UNSIGNED NULL,
    status ENUM('rascunho', 'publicado', 'arquivado')
        NOT NULL DEFAULT 'rascunho',
    publicado_em DATETIME(3) NULL,
    criado_em DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),
    atualizado_em DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_posts_blog_imagem
        FOREIGN KEY (imagem_id)
        REFERENCES midias(id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    INDEX idx_posts_blog_status_publicacao
        (status, publicado_em)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
