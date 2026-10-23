'use strict';
// Ensaio manual: grava e restaura conteúdo, incrementando a versão duas vezes.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
if (!process.argv.includes('--confirmar-banco-teste')) throw new Error('Confirme o ensaio manual.');
process.env.NODE_ENV = 'test';
const pool = require('../database');
const hash = texto => crypto.createHash('sha256').update(texto).digest('hex');
const token = crypto.randomBytes(32).toString('hex');
const csrf = crypto.createHmac('sha256', token).update('churros-admin-csrf-v1').digest('hex');
let c, servidor, original, base, headers, restaurar = false, sessaoCriada = false;
async function request(rota, dados) {
    const r = await fetch(base + '/api/' + rota, {
        method: dados ? 'PUT' : 'GET', headers, body: dados ? JSON.stringify(dados) : undefined
    });
    return {status: r.status, body: await r.json()};
}
async function restaurarConteudo() {
    if (!restaurar || !original) return;
    const atual = await request('admin/loja');
    assert.equal(atual.status, 200);
    // Não sobrescreve outra edição humana que tenha ocorrido no intervalo.
    assert.equal(atual.body.data.nome, original.nome + ' [concorrencia]');
    assert.equal(atual.body.data.versao, original.versao + 1);
    const r = await request('admin/loja', {...original, versao: atual.body.data.versao});
    assert.equal(r.status, 200);
    restaurar = false;
}
(async () => {
    c = await pool.getConnection();
    const [ambiente] = await c.query('SELECT DATABASE() AS banco, CURRENT_USER() AS conta');
    assert.equal(ambiente.banco, 'churros_em_casa_teste_017');
    assert.equal(ambiente.conta, 'churros_app_teste@localhost');
    const [lock] = await c.query("SELECT GET_LOCK('churros_teste_017_rollback_loja',0) AS obtido");
    assert.equal(Number(lock.obtido), 1);
    const [admin] = await c.query("SELECT id FROM administradores WHERE ativo=1 AND perfil='proprietario' LIMIT 1");
    assert(admin);
    const antesLoja = Array.from(await c.query('SELECT * FROM loja WHERE loja_unica=1'));
    const antesHorarios = Array.from(await c.query('SELECT * FROM horarios_semanais WHERE loja_id=? ORDER BY dia_semana', [antesLoja[0].id]));
    await c.query('INSERT INTO sessoes_admin (administrador_id,token_hash,csrf_hash,expira_em) VALUES (?,?,?,DATE_ADD(NOW(3), INTERVAL 10 MINUTE))',
        [admin.id, hash(token), hash(csrf)]);
    sessaoCriada = true;
    const app = require('../server');
    servidor = await new Promise((resolve,reject) => {const s=app.listen(0,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
    base = `http://127.0.0.1:${servidor.address().port}`;
    headers = {Origin:base,Cookie:`churros_admin=${token}`,'X-CSRF-Token':csrf,'Content-Type':'application/json'};
    const consulta = await request('admin/loja'); assert.equal(consulta.status,200); original=consulta.body.data;
    assert(original.nome.length <= 100);
    assert.equal(antesHorarios.length, 7);
    assert(antesHorarios.every(h => h.fechado || (String(h.hora_abertura).endsWith(':00') && String(h.hora_fechamento).endsWith(':00'))));
    const novo = {...original,nome:original.nome+' [concorrencia]'};
    restaurar = true;
    const respostas = await Promise.all([request('admin/loja',novo), request('admin/loja',novo)]);
    assert.deepEqual(respostas.map(r=>r.status).sort(),[200,409]);
    const publico = await fetch(base+'/api/public/loja', {headers:{Accept:'application/json'},credentials:'omit'});
    assert.equal(publico.status,200);
    assert.equal((await publico.json()).data.nome,novo.nome);
    await restaurarConteudo();
    const depoisLoja = Array.from(await c.query('SELECT * FROM loja WHERE loja_unica=1'));
    const depoisHorarios = Array.from(await c.query('SELECT * FROM horarios_semanais WHERE loja_id=? ORDER BY dia_semana',[antesLoja[0].id]));
    const semControle = registros => registros.map(({versao,atualizado_em,...resto})=>resto);
    assert.deepEqual(semControle(depoisLoja),semControle(antesLoja));
    assert.deepEqual(semControle(depoisHorarios),semControle(antesHorarios));
    assert.equal(Number(depoisLoja[0].versao),original.versao+2);
    let r=await fetch(base+'/api/admin/logout',{method:'POST',headers:{Origin:base,Cookie:headers.Cookie}});
    assert.notEqual(r.status,200); await r.arrayBuffer();
    r=await fetch(base+'/api/admin/logout',{method:'POST',headers}); assert.equal(r.status,200);
    assert.match(r.headers.get('set-cookie'),/Expires=Thu, 01 Jan 1970/i); await r.arrayBuffer();
    assert.equal((await request('admin/session')).status,401);
    assert.equal((await request('admin/loja')).status,401);
    const [sessao] = await c.query('SELECT revogado_em IS NOT NULL AS revogada FROM sessoes_admin WHERE token_hash=?',[hash(token)]);
    assert.equal(Number(sessao.revogada),1);
    console.log(JSON.stringify({resultado:'APROVADO', banco:ambiente.banco, autenticacao:'sessao temporaria real; sem teste de senha', concorrencia:respostas.map(r=>r.status), leituraPublicaSemCookie:true, conteudoRestaurado:true, versaoFinal:original.versao+2, logoutReal:true, sessaoRevogada:true}));
})().catch(e=>{console.error('ENSAIO_FALHOU',e.code||e.name);process.exitCode=1;}).finally(async()=>{
    try { await restaurarConteudo(); } catch {console.error('RESTAURACAO_EXIGE_REVISAO_MANUAL');process.exitCode=1;}
    if(c){
        if(sessaoCriada) await c.query('DELETE FROM sessoes_admin WHERE token_hash=?',[hash(token)]);
        await c.query("SELECT RELEASE_LOCK('churros_teste_017_rollback_loja')").catch(()=>{});
        c.release();
    }
    if(servidor) await new Promise(resolve=>servidor.close(resolve));
    await pool.end();
});
