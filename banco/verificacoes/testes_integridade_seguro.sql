-- Executar SOMENTE no banco descartavel
-- churros_em_casa_teste_integridade.
-- Aplicar antes as migracoes 001 a 021.
-- Nao usar --force.
-- Nunca executar no banco original.

DELIMITER //

CREATE PROCEDURE verificar_ambiente_teste()
BEGIN
    IF DATABASE() IS NULL
       OR DATABASE() <> 'churros_em_casa_teste_integridade' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'ERRO: banco de teste incorreto.';
    END IF;
END//

DELIMITER ;

CALL verificar_ambiente_teste();

DROP PROCEDURE verificar_ambiente_teste;

START TRANSACTION;

INSERT INTO loja (id, nome, historia_json)
VALUES (1, 'TESTE - rollback', JSON_ARRAY('Teste'));

SELECT COUNT(*) AS loja_temporaria FROM loja;

ROLLBACK;

SELECT COUNT(*) AS loja_apos_rollback FROM loja;