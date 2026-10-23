'use strict';

// Execução manual: node testes/rollback-loja-real.js --confirmar-banco-teste
// Não faz parte de npm test. Autenticação sintética apenas neste processo.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
if (!process.argv.includes('--confirmar-banco-teste')) {
    throw new Error('Confirme explicitamente o teste manual no banco autorizado.');
}
process.env.NODE_ENV = 'test';
const pool = require('../database');
const token = crypto.randomBytes(32).toString('hex');
const csrf = crypto.createHmac('sha256', token).update('churros-admin-csrf-v1').digest('hex');
const csrfHash = crypto.createHash('sha256').update(csrf).digest('hex');
let servidor, fiscal, observador;
let atualizacoes = 0, horariosGravados = 0, rollbacks = 0, commits = 0;

async function snapshot(c) {
    return {
        loja: Array.from(await c.query('SELECT * FROM loja WHERE loja_unica=1')),
        horarios: Array.from(await c.query('SELECT h.* FROM horarios_semanais h JOIN loja l ON l.id=h.loja_id WHERE l.loja_unica=1 ORDER BY h.dia_semana'))
    };
}

(async () => {
    fiscal = await pool.getConnection();
    const [ambiente] = await fiscal.query('SELECT DATABASE() AS banco, CURRENT_USER() AS conta');
    assert.equal(ambiente.banco, 'churros_em_casa_teste_017');
    assert.equal(ambiente.conta, 'churros_app_teste@localhost');
    const engines = await fiscal.query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('loja','horarios_semanais')");
    assert.equal(engines.length, 2);
    assert(engines.every(t => t.ENGINE === 'InnoDB'));
    // Impede outros testes deste script de rodarem simultaneamente.
    const [lock] = await fiscal.query("SELECT GET_LOCK('churros_teste_017_rollback_loja',0) AS obtido");
    assert.equal(Number(lock.obtido), 1);
    const antes = await snapshot(fiscal);
    assert.equal(antes.loja.length, 1);
    assert.equal(antes.horarios.length, 7);
    observador = await pool.getConnection();

    const dbPath = require.resolve('../database');
    require.cache[dbPath].exports = {
        async getConnection() {
            const c = await pool.getConnection();
            return {
                beginTransaction: () => c.beginTransaction(),
                async commit() {
                    commits++;
                    throw new Error('Commit proibido neste ensaio de rollback');
                },
                async rollback() { await c.rollback(); rollbacks++; },
                release: () => c.release(),
                async query(sql, params) {
                    if (sql.includes('FROM sessoes_admin s')) {
                        return [{id: 1, nome: 'Ensaio isolado', ativo: 1, perfil: 'proprietario', csrf_hash: csrfHash}];
                    }
                    if (sql.includes('INSERT INTO horarios_semanais') && Number(params[1]) === 3) {
                        assert.equal(atualizacoes, 1);
                        assert.equal(horariosGravados, 2);
                        const interno = await snapshot(c);
                        assert.equal(interno.loja[0].nome, 'Ensaio temporario de rollback');
                        assert.equal(Number(interno.loja[0].versao), Number(antes.loja[0].versao) + 1);
                        assert.equal(interno.horarios[0].hora_abertura, '08:00:00');
                        assert.equal(interno.horarios[1].hora_abertura, '08:00:00');
                        // Outra conexão não deve enxergar as alterações não confirmadas.
                        assert.deepEqual(await snapshot(observador), antes);
                        throw Object.assign(new Error('Falha controlada antes do terceiro horario'), {code: 'TESTE_ROLLBACK_REAL'});
                    }
                    const resultado = await c.query(sql, params);
                    if (sql.includes('UPDATE loja')) atualizacoes++;
                    if (sql.includes('INSERT INTO horarios_semanais')) horariosGravados++;
                    return resultado;
                }
            };
        }
    };
    const app = require('../server');
    servidor = await new Promise((resolve, reject) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
        s.once('error', reject);
    });
    const base = `http://127.0.0.1:${servidor.address().port}`;
    const headers = {Cookie: `churros_admin=${token}`, Origin: base, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json'};
    const consulta = await fetch(base + '/api/admin/loja', {headers});
    assert.equal(consulta.status, 200);
    const dados = (await consulta.json()).data;
    const resposta = await fetch(base + '/api/admin/loja', {
        method: 'PUT', headers,
        body: JSON.stringify({...dados, nome: 'Ensaio temporario de rollback', dias: ['segunda','terça','quarta','quinta','sexta','sábado','domingo'], abertura: '08:00', fechamento: '19:00'})
    });
    assert.equal(resposta.status, 500);
    const corpo = await resposta.json();
    assert.equal(corpo.ok, false);
    assert(!JSON.stringify(corpo).includes('TESTE_ROLLBACK_REAL'));
    assert.equal(atualizacoes, 1);
    assert.equal(horariosGravados, 2);
    assert.equal(rollbacks, 1);
    assert.equal(commits, 0);
    assert.deepEqual(await snapshot(observador), antes);
    console.log(JSON.stringify({resultado: 'APROVADO', banco: ambiente.banco, autenticacao: 'simulada neste processo', transacao: 'MariaDB real', statusHTTP: resposta.status, atualizacoesLoja: atualizacoes, horariosGravadosAntesDaFalha: horariosGravados, rollbacks, commits, estadoFinal: 'identico ao inicial', versao: dados.versao}));
})().catch(e => {
    console.error('TESTE_FALHOU', e.code || e.name);
    process.exitCode = 1;
}).finally(async () => {
    if (servidor) await new Promise(resolve => servidor.close(resolve));
    if (observador) observador.release();
    if (fiscal) {
        await fiscal.query("SELECT RELEASE_LOCK('churros_teste_017_rollback_loja')").catch(() => {});
        fiscal.release();
    }
    await pool.end();
});
