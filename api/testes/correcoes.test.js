'use strict';
// HTTP real em loopback; banco substituido por double em memoria. Nao le .env.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const argon2 = require('argon2');
let servidor, base, senhaHash, sessao, consultas = [], falharProdutos = false;
let perfil = 'proprietario', loja, horarios = [], snapshot, falharHorario = false;
const conexao = {
    async beginTransaction() { snapshot = structuredClone({loja, horarios}); },
    async commit() { snapshot = undefined; },
    async rollback() { if (snapshot) { ({loja, horarios} = snapshot); snapshot = undefined; } }, release() {},
    async query(sql, params = []) {
        consultas.push(sql);
        if (sql.startsWith('SET TRANSACTION') || sql.startsWith('START TRANSACTION')) return [];
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
            assert.match(sql, /DATE_ADD\(NOW\(3\), INTERVAL 8 HOUR\)/);
            assert.equal(params.length,3);
            sessao = {token:params[1],csrf:params[2],revogada:false}; return {affectedRows:1};
        }
        if (sql.includes('FROM sessoes_admin s')) {
            return sessao && !sessao.revogada && sessao.token === params[0]
                ? [{id:1,nome:'Teste',ativo:1,perfil,csrf_hash:sessao.csrf}] : [];
        }
        if (sql.includes('UPDATE sessoes_admin')) {
            if (sessao && !sessao.revogada && sessao.token === params[0] && (!params[1] || params[1] === sessao.csrf)) {
                sessao.revogada=true; return {affectedRows:1};
            }
            return {affectedRows:0};
        }
        if (sql.includes('FROM loja')) {
            if (sql.includes('publicada = 1')) {
                assert.match(sql, /loja_unica = 1/);
                assert(!sql.includes('SELECT *'));
                return loja?.publicada === 1 ? [structuredClone(loja)] : [];
            }
            return loja ? [structuredClone(loja)] : [];
        }
        if (sql.includes('FROM midias')) return params[0] === 7 ? [{caminho_arquivo:'/images/sobre.png'}] : [];
        if (sql.includes('FROM horarios_semanais')) { assert.equal(params[0],42); return structuredClone(horarios); }
        if (sql.includes('UPDATE loja')) {
            assert.equal(params[10],42); assert.equal(params[11],loja.versao);
            const keys=['nome','endereco','telefone','historia_json','instagram_url','whatsapp_url','link_ifood','link_99food','mapa_url','alt_sobre'];
            keys.forEach((key,i)=>{loja[key]=params[i];});loja.versao++; return {affectedRows:1};
        }
        if (sql.includes('INSERT INTO horarios_semanais')) {
            assert.equal(params[0],42);
            if (falharHorario && params[1] === 3) throw Object.assign(new Error('falha simulada'),{code:'TESTE_HORARIO'});
            horarios=horarios.filter(h=>h.dia_semana!==params[1]);
            horarios.push({dia_semana:params[1],hora_abertura:params[2],hora_fechamento:params[3],fechado:params[4]});
            return {affectedRows:1};
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

test('Loja: permissoes, validacao, preservacao de imagem, versao e rollback simulado',async()=>{
    let res=await fetch(base+'/api/admin/loja');assert.equal(res.status,401);
    res=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:'teste@example.invalid',senha:'senha-somente-para-teste'})});
    assert.equal(res.status,200);
    const headers={Cookie:res.headers.get('set-cookie').split(';')[0],Origin:base,'Content-Type':'application/json'};
    headers['X-CSRF-Token']=(await res.json()).data.csrfToken;
    const get=()=>fetch(base+'/api/admin/loja',{headers});
    const put=data=>fetch(base+'/api/admin/loja',{method:'PUT',headers,body:JSON.stringify(data)});
    perfil='outro'; res=await get();assert.equal(res.status,403);res=await put({});assert.equal(res.status,403);perfil='proprietario';
    res=await get();assert.equal(res.status,404);assert.match((await res.json()).mensagem,/configuração inicial/);
    loja={id:42,nome:'Loja teste',endereco:'Endereço teste',versao:1,historia_json:'["História teste"]',imagem_sobre_id:7,alt_sobre:'Foto teste'};
    horarios=[{dia_semana:1,hora_abertura:'10:00:00',hora_fechamento:'22:40:00',fechado:0}];
    res=await get();assert.equal(res.status,200);const data=(await res.json()).data;
    assert.equal(data.id,'42');assert.equal(data.imagemSobre,'/images/sobre.png');assert.equal(data.historia_json,undefined);
    const token=headers['X-CSRF-Token'];delete headers['X-CSRF-Token'];res=await put(data);assert.equal(res.status,403);headers['X-CSRF-Token']=token;
    for (const invalid of [{nome:''},{versao:0},{dias:['segunda','segunda']},{fechamento:'09:00'},{instagram:'javascript:alert(1)'},{imagemSobre:''}]) {
        res=await put({...data,...invalid});assert.equal(res.status,400,JSON.stringify(invalid));assert.equal(typeof(await res.json()).mensagem,'string');
    }
    res=await put({...data,nome:'Nome atualizado'});assert.equal(res.status,200);assert.equal((await res.json()).data.versao,2);
    assert.equal(loja.imagem_sobre_id,7);assert.equal(horarios.length,7);
    res=await get();assert.equal((await res.json()).data.nome,'Nome atualizado');
    res=await put(data);assert.equal(res.status,409);assert.equal(loja.versao,2);
    falharHorario=true;
    try {res=await put({...data,versao:2,nome:'Não gravar'});assert.equal(res.status,500);assert.equal(loja.nome,'Nome atualizado');assert.equal(loja.versao,2);}
    finally {falharHorario=false;}
    loja.historia_json='inválido';res=await get();assert.equal(res.status,409);loja.historia_json='["História"]';
    horarios[1]={dia_semana:2,hora_abertura:'11:00:00',hora_fechamento:'22:40:00',fechado:0};res=await get();assert.equal(res.status,409);
});

test('cliente administrativo preserva erros de validacao sem expor falhas internas',async()=>{
    const source=fs.readFileSync(path.join(__dirname,'../../admin/api.js'),'utf8');
    let response;
    const context={window:{},document:{currentScript:{src:'http://localhost/admin/api.js'}},location:{hostname:'localhost',protocol:'http:'},URL,FormData,AbortController,setTimeout,clearTimeout,fetch:async()=>response};
    vm.runInNewContext(source,context);
    response={ok:false,status:400,json:async()=>({mensagem:'O nome é obrigatório.'})};
    await assert.rejects(context.window.apiAdmin.request('loja'),/O nome é obrigatório/);
    response={ok:false,status:500,json:async()=>({mensagem:'segredo interno'})};
    await assert.rejects(context.window.apiAdmin.request('loja'),/O servidor não confirmou/);
    response={ok:false,status:409,json:async()=>{throw new Error('HTML');}};
    await assert.rejects(context.window.apiAdmin.request('loja'),/Este registro mudou/);
});

test('Loja publica: campos permitidos, publicacao, links e falha sem detalhes', async()=>{
    loja.publicada=1;
    loja.historia_json='["Texto <script> inerte"]';
    loja.link_ifood='javascript:alert(1)';
    loja.instagram_url='https://www.instagram.com/casa/';
    let res=await fetch(base+'/api/public/loja');
    assert.equal(res.status,200);
    assert.equal(res.headers.get('cache-control'),'no-store');
    const data=(await res.json()).data;
    assert.deepEqual(Object.keys(data).sort(), ['nome','endereco','telefone','ifood','food99','instagram','whatsapp','mapa','historia','imagemSobre','altSobre','fuso','horarios'].sort());
    assert.equal(data.ifood,'');
    assert.equal(data.imagemSobre,'/images/sobre.png');
    assert.equal(data.historia[0],'Texto <script> inerte');
    assert.equal(data.versao,undefined);
    assert.equal(data.id,undefined);
    loja.publicada=0; res=await fetch(base+'/api/public/loja'); assert.equal(res.status,404);
    loja.publicada=1; loja.historia_json='invalido';
    res=await fetch(base+'/api/public/loja'); assert.equal(res.status,503);
    assert.deepEqual(await res.json(),{ok:false,data:null});
    loja.historia_json='[]';
});
