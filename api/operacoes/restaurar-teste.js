'use strict';
const assert=require('node:assert/strict');
const mariadb=require('mariadb');
const dotenv=require('dotenv');
const {fs,path,hash,dentro,executar,inventario}=require('./backup-comum');
(async()=>{
    if(!process.argv.includes('--confirmar-restauracao'))throw new Error('CONFIRME_RESTAURACAO');
    const pasta=dentro(process.argv[2]||''),m=JSON.parse(await fs.readFile(path.join(pasta,'manifesto.json'),'utf8'));
    assert.equal(m.origem,'churros_em_casa_teste_017');
    const sql=await fs.readFile(path.join(pasta,'banco.sql'));assert.equal(hash(sql),m.sql);
    const env=dotenv.parse(await fs.readFile(path.resolve(__dirname,'../.env.restauracao')));
    assert.equal(env.DB_NAME,'churros_em_casa_teste_restauracao');assert.equal(env.DB_USER,'churros_restore_teste');
    assert(['localhost','127.0.0.1'].includes(env.DB_HOST));
    const c=await mariadb.createConnection({host:env.DB_HOST,port:Number(env.DB_PORT||3306),user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME,timezone:'+00:00'});
    try{
        const [r]=await c.query('SELECT DATABASE() AS banco');assert.equal(r.banco,env.DB_NAME);
        const tabelas=await c.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');assert.equal(tabelas.length,0,'A base de restauração deve estar vazia; nenhum dado existente será removido.');
        await executar('mariadb',['--host='+env.DB_HOST,'--port='+(env.DB_PORT||3306),'--user='+env.DB_USER,'--database='+env.DB_NAME,'--default-character-set=utf8mb4','--binary-mode'],{...process.env,MYSQL_PWD:env.DB_PASSWORD},sql);
        assert.deepEqual(await inventario(c),m.tabelas);
        const destino=path.join(pasta,'uploads-restaurados');await fs.mkdir(destino,{recursive:true});
        for(const [nome,digest] of Object.entries(m.uploads)){assert(/^[a-f0-9-]{36}\.webp$/.test(nome));const b=await fs.readFile(path.join(pasta,'uploads',nome));assert.equal(hash(b),digest);await fs.writeFile(path.join(destino,nome),b);assert.equal(hash(await fs.readFile(path.join(destino,nome))),digest);}
        console.log(JSON.stringify({resultado:'APROVADO',banco:r.banco,tabelas:Object.keys(m.tabelas).length,dadosESchemas:'hashes idênticos ao backup',imagens:Object.keys(m.uploads).length,aplicacao:'não conectada à base restaurada'}));
        await fs.writeFile(path.join(pasta,'resultado-restauracao.json'),JSON.stringify({resultado:'APROVADO',banco:r.banco,data:new Date().toISOString(),tabelas:Object.keys(m.tabelas).length}),{flag:'wx'});
    }finally{await c.end();}
})().catch(e=>{console.error('RESTAURACAO_FALHOU',e.code||e.name);process.exitCode=1;});
