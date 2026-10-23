'use strict';
// Somente leitura. Compara presença de objetos das migrações com o banco permitido.
process.env.NODE_ENV = 'test';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const pool = require('../database');
(async () => {
    const c = await pool.getConnection();
    try {
        await c.query('START TRANSACTION READ ONLY');
        const [info] = await c.query('SELECT DATABASE() AS banco, VERSION() AS versao, @@foreign_key_checks AS fks, @@check_constraint_checks AS checks');
        assert.equal(info.banco, 'churros_em_casa_teste_017');
        assert.equal(Number(info.fks), 1); assert.equal(Number(info.checks), 1);
        const pasta = path.join(__dirname, '../../banco/migracoes');
        const arquivos = fs.readdirSync(pasta).filter(f => /^\d{3}.*\.sql$/.test(f)).sort();
        assert.equal(arquivos.length, 22);
        const tabelas = new Set(), constraints = new Map(), indices = new Map(), colunas = new Map();
        for (const arquivo of arquivos) {
            const texto = fs.readFileSync(path.join(pasta, arquivo), 'utf8').replace(/--[^\r\n]*/g, '');
            for (const trecho of texto.split(';')) {
                const m = /(?:CREATE|ALTER) TABLE\s+(\w+)/i.exec(trecho);
                if (!m) continue;
                const tabela = m[1]; tabelas.add(tabela);
                for (const x of trecho.matchAll(/(?:ADD\s+)?CONSTRAINT\s+(\w+)/gi)) {
                    if (!new RegExp('DROP\\s+CONSTRAINT\\s+' + x[1], 'i').test(trecho)) constraints.set(tabela + '.' + x[1], true);
                }
                for (const x of trecho.matchAll(/(?:UNIQUE KEY|ADD INDEX|KEY)\s+(\w+)\s*\(([^)]+)\)/gi)) indices.set(tabela + '.' + x[1], x[2].replace(/\s/g, ''));
                for (const x of trecho.matchAll(/(?:ADD|MODIFY) COLUMN\s+(\w+)/gi)) colunas.set(tabela + '.' + x[1], true);
                if (/CREATE TABLE/i.test(trecho)) {
                    for (const x of trecho.matchAll(/^\s*(\w+)\s+(?:INT|TINYINT|BIGINT|VARCHAR|CHAR|TEXT|LONGTEXT|DATETIME|DATE|TIME|BOOLEAN|DECIMAL|ENUM|JSON)\b/gim)) colunas.set(tabela + '.' + x[1], true);
                }
            }
        }
        const reais = await c.query('SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
        for (const tabela of tabelas) assert(reais.some(t => t.TABLE_NAME === tabela && t.ENGINE === 'InnoDB'), tabela);
        const restricoes = await c.query('SELECT TABLE_NAME,CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE()');
        for (const chave of constraints.keys()) assert(restricoes.some(r => r.TABLE_NAME + '.' + r.CONSTRAINT_NAME === chave), chave);
        const existentes = await c.query('SELECT TABLE_NAME,COLUMN_NAME,COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()');
        for (const chave of colunas.keys()) assert(existentes.some(r => r.TABLE_NAME + '.' + r.COLUMN_NAME === chave), chave);
        assert.equal(existentes.find(r => r.TABLE_NAME === 'horarios_semanais' && r.COLUMN_NAME === 'loja_id').COLUMN_DEFAULT, null);
        const estatisticas = await c.query('SELECT TABLE_NAME,INDEX_NAME,COLUMN_NAME,SEQ_IN_INDEX FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX');
        for (const [chave, campos] of indices) assert.equal(estatisticas.filter(r => r.TABLE_NAME + '.' + r.INDEX_NAME === chave).map(r => r.COLUMN_NAME).join(','), campos, chave);
        const [orf] = await c.query('SELECT COUNT(*) AS n FROM horarios_semanais h LEFT JOIN loja l ON l.id=h.loja_id WHERE l.id IS NULL');
        assert.equal(Number(orf.n), 0);
        await c.rollback();
        console.log(JSON.stringify({resultado:'APROVADO', ...info, arquivos:arquivos.length, tabelas:tabelas.size, colunas:colunas.size, restricoesNomeadas:constraints.size, indicesNomeados:indices.size,
            limite:'Verifica presenca de colunas/restricoes e composicao de indices nomeados; nao comprova historico de migracoes nem equivalencia integral de tipos, CHECKs e FKs.'}, (_,v) => typeof v === 'bigint' ? v.toString() : v));
    } finally { c.release(); }
})().catch(e => { console.error('ESTRUTURA_FALHOU', e.code || e.name, e.code ? '' : e.message); process.exitCode = 1; }).finally(() => pool.end());
