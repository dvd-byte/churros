
CREATE TABLE horarios_semanais (
    id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dia_semana TINYINT UNSIGNED NOT NULL UNIQUE,
    hora_abertura TIME NULL,
    hora_fechamento TIME NULL,
    fechado BOOLEAN NOT NULL DEFAULT FALSE,
    atualizado_em DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT chk_horarios_dia_semana
        CHECK (dia_semana BETWEEN 1 AND 7),

    CONSTRAINT chk_horarios_horas
        CHECK (
            fechado = TRUE
            OR (
                hora_abertura IS NOT NULL
                AND hora_fechamento IS NOT NULL
            )
        )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
