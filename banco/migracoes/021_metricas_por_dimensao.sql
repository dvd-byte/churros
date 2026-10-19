-- Totais de metricas_diarias sao historico legado: impossivel inferir pagina,
-- origem ou dispositivo a partir deles. Nao inventar distribuicoes nem somar
-- as duas tabelas no dashboard.
CREATE TABLE metricas_dimensoes_diarias (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    data_referencia DATE NOT NULL,
    evento ENUM('visualizacao','clique_ifood','clique_99','clique_whatsapp') NOT NULL,
    pagina VARCHAR(255) COLLATE utf8mb4_bin NOT NULL,
    origem ENUM('direto','instagram','busca','referencia','desconhecido') NOT NULL,
    dispositivo ENUM('celular','tablet','desktop','desconhecido') NOT NULL,
    quantidade BIGINT UNSIGNED NOT NULL DEFAULT 0,
    UNIQUE KEY uq_metrica_dimensoes (data_referencia, evento, pagina, origem, dispositivo),
    INDEX idx_metricas_periodo_evento (data_referencia, evento),
    CONSTRAINT chk_metricas_pagina CHECK (CHAR_LENGTH(TRIM(pagina)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- NULL = coleta nunca ativada, nao zero visitas. API configura ao ativar.
ALTER TABLE loja ADD COLUMN metricas_inicio_em DATETIME(3) NULL;
