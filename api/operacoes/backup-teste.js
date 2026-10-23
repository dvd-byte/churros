'use strict';
process.env.NODE_ENV='test';
const {fs,path,raiz,hash,executar,inventario}=require('./backup-comum');
const pool=require('../database');
const net=require('node:net');
(async()=>{
    await new Promise((resolve,reject)=>{const s=net.createConnection({host:'127.0.0.1',port:Number(process.env.PORT||3000)});s.once('connect',()=>{s.destroy();reject(new Error('PARE_A_API_ANTES_DO_BACKUP'));});s.once('error',e=>e.code==='ECONNREFUSED'?resolve():reject(new Error('NAO_FOI_POSSIVEL_CONFERIR_API')));});
    const c=await pool.getConnection();try{
        const [r]=await c.query('SELECT DATABASE() AS banco');if(r.banco!=='churros_em_casa_teste_017')throw new Error('BANCO_NAO_PERMITIDO');
        await fs.mkdir(raiz,{recursive:true});const destino=path.join(raiz,'teste-'+new Date().toISOString().replace(/[:.]/g,'-'));await fs.mkdir(destino);
        const antes=await inventario(c),sql=path.join(destino,'banco.sql');
        await executar('mariadb-dump',['--host='+process.env.DB_HOST,'--port='+(process.env.DB_PORT||3306),'--user='+process.env.DB_USER,'--single-transaction','--skip-lock-tables','--skip-add-locks','--skip-triggers','--default-character-set=utf8mb4','--hex-blob','--result-file='+sql,process.env.DB_NAME],{...process.env,MYSQL_PWD:process.env.DB_PASSWORD||''});
        const depois=await inventario(c);if(JSON.stringify(antes)!==JSON.stringify(depois))throw new Error('BANCO_MUDOU_DURANTE_BACKUP');
        const uploads=path.resolve(__dirname,'../var/uploads'),destUploads=path.join(destino,'uploads');await fs.mkdir(destUploads);const midias={};
        const nomes=await fs.readdir(uploads).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
        for(const nome of nomes){if(!/^[a-f0-9-]{36}\.webp$/.test(nome))continue;const b=await fs.readFile(path.join(uploads,nome));await fs.writeFile(path.join(destUploads,nome),b,{flag:'wx'});midias[nome]=hash(b);}
        await fs.writeFile(path.join(destino,'manifesto.json'),JSON.stringify({origem:r.banco,criadoEm:new Date().toISOString(),sql:hash(await fs.readFile(sql)),tabelas:antes,uploads:midias,limite:'Dump de tabelas; rotinas, eventos e triggers nao incluidos.'},null,2),{flag:'wx',mode:0o600});
        console.log('BACKUP_LOCAL_CRIADO',destino);console.log('Não enviar esta pasta ao chat ou ao GitHub.');
    }finally{c.release();}
})().catch(e=>{console.error('BACKUP_FALHOU',e.code||e.message);process.exitCode=1;}).finally(()=>pool.end());
