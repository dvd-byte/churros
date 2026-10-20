'use strict';
// HTTP real em loopback; banco substituido por double em memoria. Nao le .env.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const argon2 = require('argon2');
let servidor, base, senhaHash, sessao, consultas = [], falharProdutos = false;
const conexao = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async query(sql, params = []) {
        consultas.push(sql);
        if (sql.includes('FROM produtos AS p')) {
            if (falharProdutos) throw Object.assign(new Error('segredo de teste'), {code:'TESTE_DB'});
            assert.match(sql, /c\.status\s*=\s*'publicado'/);
            assert.match(sql, /p\.status\s*=\s*'publicado'/);
            assert.match(sql, /g\.ativo\s*=\s*1/);
            assert.match(sql, /g\.categoria_id\s*=\s*p\.categoria_id/);
            return [{ id: 1, nome: 'Fixture publicada', disponivel: 0 }];
        }
        if (sql.includes('FROM administradores')) {
            return params[0] === 'teste@example.invalid' ? [{id:1,nome:'Teste',ativo:1,senha_hash:senhaHash}] : [];
        }
        if (sql.includes('INSERT INTO sessoes_admin')) {
            sessao = {token:params[1],csrf:params[2],revogada:false}; return {affectedRows:1};
        }
        if (sql.includes('FROM sessoes_admin s')) {
            return sessao && !sessao.revogada && sessao.token === params[0]
                ? [{id:1,nome:'Teste',ativo:1,perfil:'proprietario',csrf_hash:sessao.csrf}] : [];
        }
        if (sql.includes('UPDATE sessoes_admin')) {
            if (sessao && !sessao.revogada && sessao.token === params[0] && (!params[1] || params[1] === sessao.csrf)) {
                sessao.revogada=true; return {affectedRows:1};
            }
            return {affectedRows:0};
        }
        throw new Error('SQL inesperado no double');
    }
};
before(async () => {
    process.env.NODE_ENV='test'; process.env.DB_NAME='churros_em_casa_teste_017';
    const dbPath=require.resolve('../database');
    require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{getConnection:async()=>conexao}};
    senhaHash=await argon2.hash('senha-somente-para-teste', {type:argon2.argon2id});
    const app=require('../server');
    servidor=await new Promise((resolve,reject)=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
    base=`http://127.0.0.1:${servidor.address().port}`;
});
after(async () => { if(servidor) await new Promise(resolve=>servidor.close(resolve)); });

test('recursos publicos disponiveis sem abrir a raiz privada',async()=>{
    for(const url of ['/','/index.html','/index.css','/index.js','/admin/','/admin/api.js','/images/logo.png','/paginas/cardapio.html','/js/paginas.js']) {
        const res=await fetch(base+url); assert.equal(res.status,200,url); await res.arrayBuffer();
    }
    for(const url of ['/admin/INTEGRACAO.md','/banco/INTEGRACAO-API.md','/api/.env','/.git/config','/api/server.js','/images/.env','/paginas/INTEGRACAO.md']) {
        const res=await fetch(base+url); assert.equal(res.status,404,url); await res.arrayBuffer();
    }
    const redirect=await fetch(base+'/admin',{redirect:'manual'});
    assert.equal(redirect.status,308); assert.equal(redirect.headers.get('location'),'/admin/');
});
test('rota publica consulta somente status publicado e preserva disponibilidade',async()=>{
    const res=await fetch(base+'/api/produtos');assert.equal(res.status,200);
    const json=await res.json();assert.equal(json.ok,true);assert.equal(json.data.items[0].disponivel,0);
    assert(consultas.some(sql=>sql.includes("p.status = 'publicado'")));
});
test('erros de API retornam JSON sem stack ou detalhes internos',async()=>{
    let res=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:'{'});
    assert.equal(res.status,400);assert.equal((await res.json()).ok,false);
    res=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({dados:'x'.repeat(110000)})});
    assert.equal(res.status,413);assert.equal((await res.json()).ok,false);
    res=await fetch(base+'/api/admin/dashboard');assert.equal(res.status,404);assert.equal((await res.json()).ok,false);
    falharProdutos=true;
    try { res=await fetch(base+'/api/produtos');assert.equal(res.status,500);const text=await res.text();assert.equal(JSON.parse(text).ok,false);assert(!text.includes('segredo')); }
    finally {falharProdutos=false;}
});
test('autenticacao, CSRF e logout preservados com banco simulado',async()=>{
    let res=await fetch(base+'/api/admin/session');assert.equal(res.status,401);
    res=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://origem-invalida.invalid'},body:'{}'});
    assert.equal(res.status,403);
    res=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:'teste@example.invalid',senha:'senha-somente-para-teste'})});
    assert.equal(res.status,200);const cookie=res.headers.get('set-cookie');assert.match(cookie,/HttpOnly/i);
    assert.match(cookie,/SameSite=Strict/i);const headers={Cookie:cookie.split(';')[0],Origin:base};
    res=await fetch(base+'/api/admin/session',{headers});assert.equal(res.status,200);
    const session=await res.json();assert.equal(session.data.user.permissions[0],'*');
    res=await fetch(base+'/api/admin/logout',{method:'POST',headers});assert.notEqual(res.status,200);
    headers['X-CSRF-Token']=session.data.csrfToken;
    res=await fetch(base+'/api/admin/logout',{method:'POST',headers});assert.equal(res.status,200);
    res=await fetch(base+'/api/admin/session',{headers});assert.equal(res.status,401);
});
test('configuracao absoluta, UTC e bloqueios antes do pool',()=>{
    const source=fs.readFileSync(path.join(__dirname,'../database.js'),'utf8');
    function load(env) {
        let dotenvPath, poolOptions;
        const context={process:{env},__dirname:path.resolve(__dirname,'..'),module:{exports:{}},require(name){
            if(name==='node:path')return path;
            if(name==='dotenv')return {config(options){dotenvPath=options.path;}};
            if(name==='mariadb')return {createPool(options){poolOptions=options;return {};}};
            throw Error(name);
        }};
        vm.runInNewContext(source,context);return {dotenvPath,poolOptions};
    }
    const env={NODE_ENV:'test',DB_NAME:'churros_em_casa_teste_017',DB_HOST:'localhost',DB_USER:'teste'};
    const result=load(env);assert.equal(result.dotenvPath,path.resolve(__dirname,'../.env.teste'));
    assert.equal(result.poolOptions.timezone,'+00:00');assert.equal(result.poolOptions.port,3306);
    assert.throws(()=>load({...env,NODE_ENV:'production'}),/bloqueada/);
    assert.throws(()=>load({...env,DB_NAME:'churros_em_casa'}),/não autorizado/);
    assert.throws(()=>load({...env,DB_PORT:'abc'}),/DB_PORT/);
});
