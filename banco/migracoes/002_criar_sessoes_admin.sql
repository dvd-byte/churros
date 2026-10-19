
CREATE TABLE sessoes_admin (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    administrador_id INT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expira_em DATETIME(3) NOT NULL,
    revogado_em DATETIME(3) NULL,

    CONSTRAINT fk_sessoes_admin_administrador
        FOREIGN KEY (administrador_id)
        REFERENCES administradores(id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    INDEX idx_sessoes_admin_administrador (administrador_id),
    INDEX idx_sessoes_admin_expiracao (expira_em)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
