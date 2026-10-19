-- SOMENTE banco DESCARTAVEL, vazio, apos 001..021. Nao usar em producao.
-- Requer permissoes CREATE ROUTINE. Em erro: ROLLBACK e descarte a base de teste.
-- Nao executar com opcao --force. Helpers existem somente nesta base de teste.
DELIMITER //
CREATE PROCEDURE teste_banco_espera_erro(IN instrucao TEXT, IN codigo INT)
BEGIN
    DECLARE erro INT DEFAULT 0;
    SET @instrucao_teste = instrucao;
    PREPARE stmt_teste FROM @instrucao_teste;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
            GET DIAGNOSTICS CONDITION 1 erro = MYSQL_ERRNO;
        EXECUTE stmt_teste;
    END;
    DEALLOCATE PREPARE stmt_teste;
    IF erro <> codigo THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falha: restricao nao retornou o erro esperado';
    END IF;
END//
DELIMITER ;

START TRANSACTION;
INSERT INTO loja (id,nome,historia_json) VALUES (1,'TESTE - rollback',JSON_ARRAY('Teste'));
CALL teste_banco_espera_erro('INSERT INTO loja(id,nome) VALUES(2,''Teste'')',4025);
CALL teste_banco_espera_erro('UPDATE loja SET historia_json=JSON_OBJECT() WHERE id=1',4025);
INSERT INTO horarios_semanais (dia_semana,hora_abertura,hora_fechamento) VALUES (1,'10:00:00','22:40:00');
CALL teste_banco_espera_erro('INSERT INTO horarios_semanais(dia_semana,hora_abertura,hora_fechamento) VALUES(2,''22:00:00'',''10:00:00'')',4025);
CALL teste_banco_espera_erro('INSERT INTO horarios_semanais(dia_semana,fechado,hora_abertura,hora_fechamento) VALUES(3,TRUE,''10:00:00'',''20:00:00'')',4025);

INSERT INTO categorias_cardapio(nome,slug) VALUES ('Teste A','teste-a'); SET @cat_a=LAST_INSERT_ID();
INSERT INTO categorias_cardapio(nome,slug) VALUES ('Teste B','teste-b'); SET @cat_b=LAST_INSERT_ID();
INSERT INTO grupos_cardapio(categoria_id,nome) VALUES (@cat_a,'Grupo teste'); SET @grupo=LAST_INSERT_ID();
INSERT INTO produtos(categoria_id,grupo_id,nome,preco) VALUES(@cat_a,@grupo,'Produto teste',1.50);
CALL teste_banco_espera_erro(CONCAT('INSERT INTO produtos(categoria_id,grupo_id,nome,preco) VALUES(',@cat_b,',',@grupo,',''Grupo incorreto'',1)'),1452);
CALL teste_banco_espera_erro(CONCAT('INSERT INTO produtos(categoria_id,grupo_id,nome,preco) VALUES(',@cat_a,',',@grupo,',''Preco incorreto'',-1)'),4025);

INSERT INTO promocoes(titulo) VALUES ('Teste cupom'); SET @promo=LAST_INSERT_ID();
CALL teste_banco_espera_erro(CONCAT('UPDATE promocoes SET status=''ativo'' WHERE id=',@promo),4025);
UPDATE promocoes SET plataforma='ambas',codigo_ifood='TESTE',codigo_99='TESTE99',
    inicio_em='2026-01-01',termina_em='2026-02-01',condicoes='Teste',status='ativo' WHERE id=@promo;
CALL teste_banco_espera_erro(CONCAT('UPDATE promocoes SET codigo_99=NULL WHERE id=',@promo),4025);
CALL teste_banco_espera_erro(CONCAT('UPDATE promocoes SET arquivada_em=CURRENT_TIMESTAMP WHERE id=',@promo),4025);
INSERT INTO resgates(promocao_id,identificador_hash,status) VALUES(@promo,REPEAT('a',64),'validado');
CALL teste_banco_espera_erro(CONCAT('INSERT INTO resgates(promocao_id,identificador_hash,status) VALUES(',@promo,',REPEAT(''a'',64),''validado'')'),1062);
CALL teste_banco_espera_erro(CONCAT('DELETE FROM promocoes WHERE id=',@promo),1451);

INSERT INTO metricas_dimensoes_diarias(data_referencia,evento,pagina,origem,dispositivo,quantidade)
VALUES('2026-01-01','visualizacao','/','direto','celular',1);
CALL teste_banco_espera_erro('INSERT INTO metricas_dimensoes_diarias(data_referencia,evento,pagina,origem,dispositivo) VALUES(''2026-01-01'',''visualizacao'',''/'',''direto'',''celular'')',1062);
ROLLBACK;
DROP PROCEDURE teste_banco_espera_erro;
SELECT 'Testes de restricoes concluidos; dados de teste revertidos. Nao testa API ou concorrencia.' AS resultado;
