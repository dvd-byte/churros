'use strict';
process.env.NODE_ENV='test';
const fs=require('node:fs/promises');
const path=require('node:path');
const pool=require('../database');
const pasta=path.resolve(__dirname,'../var/uploads');
const referencias="NOT EXISTS(SELECT 1 FROM categorias_cardapio c WHERE c.imagem_id=m.id) AND NOT EXISTS(SELECT 1 FROM produtos p WHERE p.imagem_id=m.id) AND NOT EXISTS(SELECT 1 FROM posts_blog b WHERE b.imagem_id=m.id) AND NOT EXISTS(SELECT 1 FROM galeria g WHERE g.midia_id=m.id) AND NOT EXISTS(SELECT 1 FROM loja l WHERE l.imagem_sobre_id=m.id)";
function alvo(nome){if(!/^[a-f0-9-]{36}\.webp$/.test(nome))throw new Error('ARQUIVO_NAO_PERMITIDO');const p=path.resolve(pasta,nome);if(!p.startsWith(pasta+path.sep))throw new Error('CAMINHO_NAO_PERMITIDO');return p;}
(async()=>{
    const excluir=process.argv.includes('--excluir'),c=await pool.getConnection();let removidos=0;
    try{
        const [b]=await c.query('SELECT DATABASE() AS banco');if(b.banco!=='churros_em_casa_teste_017')throw new Error('BANCO_NAO_PERMITIDO');
        const rows=await c.query(`SELECT m.id,m.caminho_arquivo FROM midias m WHERE m.criado_em<DATE_SUB(NOW(3),INTERVAL 48 HOUR) AND ${referencias}`);
        const candidatos=rows.filter(m=>/^\/uploads\/[a-f0-9-]{36}\.webp$/.test(m.caminho_arquivo));
        for(const m of candidatos){
            const arquivo=alvo(path.basename(m.caminho_arquivo));if(!excluir)continue;
            await c.beginTransaction();try{
                await c.query('SELECT id FROM midias WHERE id=? FOR UPDATE',[m.id]);
                const r=await c.query(`DELETE m FROM midias m WHERE m.id=? AND ${referencias}`,[m.id]);await c.commit();
                if(Number(r.affectedRows)){await fs.unlink(arquivo).catch(e=>{if(e.code!=='ENOENT')throw e;});removidos++;}
            }catch(e){await c.rollback().catch(()=>{});throw e;}
        }
        const registradas=new Set((await c.query('SELECT caminho_arquivo FROM midias')).map(m=>m.caminho_arquivo));
        let arquivosOrfaos=0;for(const nome of await fs.readdir(pasta).catch(e=>{if(e.code==='ENOENT')return [];throw e;})){
            if(!/^[a-f0-9-]{36}\.webp$/.test(nome)||registradas.has('/uploads/'+nome))continue;
            const arquivo=alvo(nome),stat=await fs.lstat(arquivo);if(!stat.isFile()||Date.now()-stat.mtimeMs<48*3600000)continue;
            arquivosOrfaos++;if(excluir){await fs.unlink(arquivo);removidos++;}
        }
        console.log(JSON.stringify({modo:excluir?'exclusão explícita':'somente leitura',midiasSemReferencia:candidatos.length,arquivosSemRegistro:arquivosOrfaos,idadeMinimaHoras:48,removidos}));
    }finally{c.release();}
})().catch(e=>{console.error('LIMPEZA_FALHOU',e.code||e.name);process.exitCode=1;}).finally(()=>pool.end());
