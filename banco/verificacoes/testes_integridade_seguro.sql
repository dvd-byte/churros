-- SOMENTE MariaDB: base DESCARTAVEL vazia churros_em_casa_teste_integridade.
-- Aplicar 001..022 antes. Nao usar --force. Nunca executar no banco original.
-- Bloco anonimo: nenhuma rotina/tabela criada antes da guarda de ambiente.
-- Falha causa rollback. Contadores AUTO_INCREMENT podem avancar.
DELIMITER //
BEGIN NOT ATOMIC
    DECLARE erro INT DEFAULT 0;
    DECLARE cat_a INT;
    DECLARE cat_b INT;
    DECLARE grupo INT;
    DECLARE promo INT;
    IF DATABASE() IS NULL OR DATABASE() <> 'churros_em_casa_teste_integridade' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Banco incorreto. Nenhuma escrita autorizada.';
    ELSEIF EXISTS (SELECT 1 FROM loja) OR EXISTS (SELECT 1 FROM categorias_cardapio)
        OR EXISTS (SELECT 1 FROM promocoes) OR EXISTS (SELECT 1 FROM metricas_dimensoes_diarias) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Usar base descartavel vazia com migracoes 001..022.';
    ELSE
        BEGIN
            DECLARE EXIT HANDLER FOR SQLEXCEPTION
            BEGIN
                ROLLBACK;
                RESIGNAL;
            END;
            START TRANSACTION;
            INSERT INTO loja(id,nome,historia_json) VALUES(42,'TESTE rollback',JSON_ARRAY('Teste'));
            BEGIN
                DECLARE CONTINUE HANDLER FOR 1062 SET erro=1062;
                INSERT INTO loja(id,nome) VALUES(43,'Segunda loja');
            END;
            IF erro<>1062 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Falha: loja unica'; END IF;
            SET erro=0;
            BEGIN
                DECLARE CONTINUE HANDLER FOR 4025 SET erro=4025;
                UPDATE loja SET historia_json=JSON_OBJECT() WHERE id=42;
            END;
            IF erro<>4025 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Falha: historia array'; END IF;
            INSERT INTO horarios_semanais(loja_id,dia_semana,hora_abertura,hora_fechamento) VALUES(42,1,'10:00:00','22:40:00');
            SET erro=0;
            BEGIN
                DECLARE CONTINUE HANDLER FOR 4025 SET erro=4025;
                INSERT INTO horarios_semanais(loja_id,dia_semana,hora_abertura,hora_fechamento) VALUES(42,2,'22:00:00','10:00:00');
            END;
            IF erro<>4025 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Falha: intervalo invertido'; END IF;
            SET erro=0;
            BEGIN
                DECLARE CONTINUE HANDLER FOR 1452 SET erro=1452;
                INSERT INTO horarios_semanais(loja_id,dia_semana,fechado) VALUES(1,3,TRUE);
            END;
            IF erro<>1452 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Falha: FK horario loja'; END IF;
            INSERT INTO categorias_cardapio(nome,slug) VALUES('Teste A','teste-a'); SET cat_a=LAST_INSERT_ID();
            INSERT INTO categorias_cardapio(nome,slug) VALUES('Teste B','teste-b'); SET cat_b=LAST_INSERT_ID();
            INSERT INTO grupos_cardapio(categoria_id,nome) VALUES(cat_a,'Grupo teste'); SET grupo=LAST_INSERT_ID();
            INSERT INTO produtos(categoria_id,grupo_id,nome,preco) VALUES(cat_a,grupo,'Teste',1.50);
            SET erro=0;
            BEGIN
                DECLARE CONTINUE HANDLER FOR 1452 SET erro=1452;
                INSERT INTO produtos(categoria_id,grupo_id,nome,preco) VALUES(cat_b,grupo,'Teste incorreto',1);
            END;
            IF erro<>1452 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Falha: grupo de outra categoria'; END IF;
            SET erro=0;
            BEGIN
                DECLARE CONTINUE HANDLER FOR 4025 SET erro=4025;
                INSERT INTO produtos(categoria_id,grupo_id,nome,preco) VALUES(cat_a,grupo,'Preco incorreto',-1);
            END;
            IF erro<>4025 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Falha: preco negativo'; END IF;
            INSERT INTO promocoes(titulo) VALUES('Teste cupom'); SET promo=LAST_INSERT_ID();
            SET erro=0;
            BEGIN
                DECLARE CONTINUE HANDLER FOR 4025 SET erro=4025;
                UPDATE promocoes SET status='ativo' WHERE id=promo;
            END;
            IF erro<>4025 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Falha: ativacao incompleta'; END IF;
            UPDATE promocoes SET plataforma='ambas',codigo_ifood='TESTE',codigo_99='TESTE99',inicio_em='2026-01-01',termina_em='2026-02-01',condicoes='Teste',status='ativo' WHERE id=promo;
            SET erro=0;
            BEGIN
                DECLARE CONTINUE HANDLER FOR 4025 SET erro=4025;
                UPDATE promocoes SET codigo_99=NULL WHERE id=promo;
            END;
            IF erro<>4025 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Falha: codigo obrigatorio'; END IF;
            INSERT INTO resgates(promocao_id,identificador_hash,status) VALUES(promo,REPEAT('a',64),'validado');
            SET erro=0;
            BEGIN
                DECLARE CONTINUE HANDLER FOR 1062 SET erro=1062;
                INSERT INTO resgates(promocao_id,identificador_hash,status) VALUES(promo,REPEAT('a',64),'validado');
            END;
            IF erro<>1062 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Falha: resgate duplicado'; END IF;
            SET erro=0;
            BEGIN
                DECLARE CONTINUE HANDLER FOR 1451 SET erro=1451;
                DELETE FROM promocoes WHERE id=promo;
            END;
            IF erro<>1451 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Falha: historico de resgate'; END IF;
            INSERT INTO metricas_dimensoes_diarias(data_referencia,evento,pagina,origem,dispositivo,quantidade) VALUES('2026-01-01','visualizacao','/','direto','celular',1);
            SET erro=0;
            BEGIN
                DECLARE CONTINUE HANDLER FOR 1062 SET erro=1062;
                INSERT INTO metricas_dimensoes_diarias(data_referencia,evento,pagina,origem,dispositivo) VALUES('2026-01-01','visualizacao','/','direto','celular');
            END;
            IF erro<>1062 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Falha: metrica duplicada'; END IF;
            ROLLBACK;
            SELECT '11 restricoes verificadas; dados revertidos. Nao testa API ou concorrencia.' AS resultado;
        END;
    END IF;
END//
DELIMITER ;
