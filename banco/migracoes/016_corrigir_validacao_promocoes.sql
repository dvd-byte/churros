
ALTER TABLE promocoes
    DROP CONSTRAINT chk_promocoes_valor;

ALTER TABLE promocoes
    ADD CONSTRAINT chk_promocoes_valor
    CHECK (
        (
            tipo_desconto = 'informativo'
            AND valor_desconto IS NULL
        )
        OR
        (
            tipo_desconto = 'percentual'
            AND valor_desconto IS NOT NULL
            AND valor_desconto > 0
            AND valor_desconto <= 100
        )
        OR
        (
            tipo_desconto = 'valor_fixo'
            AND valor_desconto IS NOT NULL
            AND valor_desconto > 0
        )
    );
