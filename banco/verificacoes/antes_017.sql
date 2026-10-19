-- Somente leitura. Executar apos 001..016, antes de 017..021.
-- Se alguma contagem for diferente de zero: PARE e revise os dados.
-- Nao compartilhe dumps de tabelas de sessoes/resgates.
SELECT VERSION() AS versao_servidor, @@sql_mode AS sql_mode,
       @@session.time_zone AS fuso_sessao, @@foreign_key_checks AS fks_ativas;

SELECT 'loja: id diferente de 1' AS problema, COUNT(*) AS quantidade FROM loja WHERE id <> 1
UNION ALL
SELECT 'horarios sem loja 1', COUNT(*) FROM horarios_semanais WHERE NOT EXISTS (SELECT 1 FROM loja WHERE id = 1)
UNION ALL
SELECT 'horarios invalidos', COUNT(*) FROM horarios_semanais
WHERE NOT (
    (fechado = TRUE AND hora_abertura IS NULL AND hora_fechamento IS NULL)
    OR (fechado = FALSE AND hora_abertura IS NOT NULL AND hora_fechamento IS NOT NULL
        AND hora_abertura >= '00:00:00' AND hora_fechamento < '24:00:00'
        AND hora_fechamento > hora_abertura)
)
UNION ALL
SELECT 'produto sem grupo ou categoria divergente', COUNT(*) FROM produtos p
LEFT JOIN grupos_cardapio g ON g.id = p.grupo_id
WHERE g.id IS NULL OR g.categoria_id <> p.categoria_id
UNION ALL
SELECT 'sessao com expiracao invalida', COUNT(*) FROM sessoes_admin WHERE expira_em <= criado_em
UNION ALL
SELECT 'produto com versao zero', COUNT(*) FROM produtos WHERE versao = 0;

-- Convencao de dias deve ser confirmada manualmente: segunda=1, domingo=7.
SELECT dia_semana, fechado, hora_abertura, hora_fechamento FROM horarios_semanais ORDER BY dia_semana;
