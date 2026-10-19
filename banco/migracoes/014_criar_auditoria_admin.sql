
CREATE TABLE auditoria_admin (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    administrador_id INT UNSIGNED NULL,

    acao VARCHAR(100) NOT NULL,

    entidade VARCHAR(100) NOT NULL,

    entidade_id VARCHAR(100) NULL,

    detalhes JSON NULL,

    criado_em DATETIME(3)
        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_auditoria_admin_administrador
        FOREIGN KEY (administrador_id)
        REFERENCES administradores(id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    INDEX idx_auditoria_admin_administrador_data
        (administrador_id, criado_em),

    INDEX idx_auditoria_admin_entidade
        (entidade, entidade_id),

    INDEX idx_auditoria_admin_data (criado_em)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
