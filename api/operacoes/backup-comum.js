'use strict';
process.env.TZ='UTC';
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const raiz=path.resolve(__dirname,'../../backups');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function dentro(p){const r=path.resolve(p);if(!r.startsWith(raiz+path.sep))throw new Error('CAMINHO_FORA_DE_BACKUPS');return r;}
async function executar(bin,args,env,entrada){
    await new Promise((resolve,reject)=>{
        const child=spawn(bin,args,{env,windowsHide:true,stdio:[entrada?'pipe':'ignore','ignore','ignore']});
        child.once('error',()=>reject(new Error('CLIENTE_MARIADB_INDISPONIVEL')));
        child.once('close',code=>code===0?resolve():reject(new Error('OPERACAO_MARIADB_FALHOU')));
        if(entrada){child.stdin.on('error',()=>{});child.stdin.end(entrada);}
    });
}
async function inventario(c){
    const tabelas=await c.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
    const out={};for(const t of tabelas){const nome=t.TABLE_NAME;if(!/^\w+$/.test(nome))throw new Error('NOME_TABELA_INVALIDO');
        const [ddl]=await c.query('SHOW CREATE TABLE `'+nome+'`');const rows=Array.from(await c.query('SELECT * FROM `'+nome+'` ORDER BY id'));
        const dados=JSON.stringify(rows,(_,x)=>typeof x==='bigint'?x.toString():x);
        out[nome]={quantidade:rows.length,schema:hash(ddl['Create Table'].replace(/AUTO_INCREMENT=\d+\s*/g,'')),dados:hash(dados)};
    }return out;
}
module.exports={fs,path,raiz,hash,dentro,executar,inventario};
