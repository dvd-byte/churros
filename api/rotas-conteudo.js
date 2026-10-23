'use strict';
const express=require('express');
const pool=require('./database');
const v=require('./validacao');
const {specs,mapear,select,dados}=require('./conteudo');
module.exports=({autenticar,csrf,proprietario})=>{
    const router=express.Router();
    router.use((req,res,next)=>{
        if(!Object.hasOwn(specs,req.path.split('/')[1])) return next('router');
        autenticar(req,res,()=>proprietario(req,res,()=>req.method==='GET'?next():csrf(req,res,next)));
    });
    for(const [recurso,s] of Object.entries(specs)) {
        router.get('/'+recurso,async(req,res)=>{
            let c;try{c=await pool.getConnection();const rows=await c.query(select(recurso)+` ORDER BY t.${['blog','cupons'].includes(recurso)?'id':'ordem'},t.id`);res.json({ok:true,data:{items:rows.map(r=>mapear(recurso,r))}});}catch(e){v.erro(res,e);}finally{c?.release();}
        });
        for(const metodo of ['post','put','patch','delete']) router[metodo]('/'+recurso+(metodo==='post'?'':'/:id'),async(req,res)=>{
            let c;try{
                const criar=metodo==='post', ident=criar?null:v.id(req.params.id);
                const versao=criar?null:v.inteiro(req.body?.versao,'versão',1,4294967295);
                c=await pool.getConnection();await c.beginTransaction();let atual;
                if(!criar){
                    [atual]=await c.query(`SELECT ${s.colunas} FROM ${s.tabela} t WHERE t.id=? FOR UPDATE`,[ident]);
                    v.exigir(atual,'Registro não encontrado.',404);v.exigir(Number(atual.versao)===versao,'Registro modificado. Atualize a lista.',409);
                }
                let novoId=ident;
                if(metodo==='delete'){
                    if(recurso==='cupons') await c.query("UPDATE promocoes SET status='inativo',ativa=0,arquivada_em=NOW(3),versao=versao+1,atualizado_em=NOW(3) WHERE id=? AND versao=?",[ident,versao]);
                    else await c.query(`DELETE FROM ${s.tabela} WHERE id=? AND versao=?`,[ident,versao]);
                }else{
                    let corpo=req.body;
                    v.exigir(corpo&&typeof corpo==='object'&&!Array.isArray(corpo),'Informe os campos do registro.');
                    if(metodo==='patch'){
                        v.exigir(recurso!=='grupos','Grupo não possui estado editável.');
                        v.exigir(Object.keys(corpo).every(k=>['status','versao'].includes(k)),'Alteração parcial aceita somente status e versão.');
                        const [linha]=await c.query(select(recurso)+' WHERE t.id=?',[ident]);corpo={...mapear(recurso,linha),status:corpo.status};
                    }
                    let campos=await dados(recurso,corpo,c,atual);
                    if(metodo==='patch'){
                        const permitidos=['status','ativa','publicada'];
                        if(recurso==='blog'&&atual.publicado_em==null&&campos.status==='publicado')permitidos.push('publicado_em');
                        campos=Object.fromEntries(Object.entries(campos).filter(([k])=>permitidos.includes(k)));
                    }
                    const nomes=Object.keys(campos);
                    if(criar){const r=await c.query(`INSERT INTO ${s.tabela} (${nomes.join(',')}) VALUES (${nomes.map(()=>'?').join(',')})`,Object.values(campos));novoId=String(r.insertId);}
                    else await c.query(`UPDATE ${s.tabela} SET ${nomes.map(n=>n+'=?').join(',')},versao=versao+1,atualizado_em=NOW(3) WHERE id=? AND versao=?`,[...Object.values(campos),ident,versao]);
                }
                await c.query('INSERT INTO auditoria_admin (administrador_id,acao,entidade,entidade_id) VALUES (?,?,?,?)',[req.admin.id,metodo,recurso,novoId]);
                await c.commit();res.json({ok:true,data:{id:String(novoId),versao:criar?1:versao+1}});
            }catch(e){if(c)await c.rollback().catch(()=>{});v.erro(res,e);}finally{c?.release();}
        });
    }
    return router;
};
