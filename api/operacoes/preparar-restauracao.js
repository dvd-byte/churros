'use strict';
// Gera credenciais somente em arquivos locais ignorados; não imprime a senha.
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
(async()=>{
    const pasta=path.resolve(__dirname,'../var'),env=path.resolve(__dirname,'../.env.restauracao');
    try{await fs.access(env);throw new Error('CONFIGURACAO_JA_EXISTE');}catch(e){if(e.code!=='ENOENT')throw e;}
    const segredo=crypto.randomBytes(32).toString('hex');
    await fs.mkdir(pasta,{recursive:true});
    const sql=path.join(pasta,'preparar-restauracao-local.sql');
    await fs.writeFile(sql,"CREATE DATABASE IF NOT EXISTS churros_em_casa_teste_restauracao CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\nCREATE USER 'churros_restore_teste'@'localhost' IDENTIFIED BY '"+segredo+"';\nGRANT ALL PRIVILEGES ON churros_em_casa_teste_restauracao.* TO 'churros_restore_teste'@'localhost';\n",{flag:'wx',mode:0o600});
    await fs.writeFile(env,'DB_HOST=localhost\nDB_PORT=3306\nDB_USER=churros_restore_teste\nDB_PASSWORD='+segredo+'\nDB_NAME=churros_em_casa_teste_restauracao\n',{flag:'wx',mode:0o600});
    console.log('PREPARADO. Como root no MariaDB, execute SOURCE '+sql.replace(/\\/g,'/')+';');
})().catch(e=>{console.error('PREPARACAO_FALHOU',e.code||e.message);process.exitCode=1;});
