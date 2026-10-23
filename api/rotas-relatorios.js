'use strict';
const express=require('express');
const pool=require('./database');
const v=require('./validacao');
const metricas=require('./metricas');
module.exports=({autenticar,proprietario})=>{
    const router=express.Router();
    router.use((req,res,next)=>['dashboard','resgates'].includes(req.path.split('/')[1])?autenticar(req,res,()=>proprietario(req,res,next)):next('router'));
    router.get('/dashboard',async(req,res)=>{
        let c;try{c=await pool.getConnection();await c.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');const data=await metricas.dashboard(c,req.query.period||'7d');await c.commit();res.json({ok:true,data});}catch(e){if(c)await c.rollback().catch(()=>{});v.erro(res,e);}finally{c?.release();}
    });
    router.get('/resgates',async(req,res)=>{
        let c;try{c=await pool.getConnection();const p=await metricas.periodo(c,req.query.period||'7d');
            const rows=await c.query('SELECT r.id,p.titulo AS promocaoNome,r.criado_em,r.status FROM resgates r JOIN promocoes p ON p.id=r.promocao_id WHERE r.criado_em>=? AND r.criado_em<? ORDER BY r.criado_em DESC,r.id DESC LIMIT 500',[v.data(p.inicio+'T00:00','início'),v.data(p.fim+'T00:00','fim')]);
            res.json({ok:true,data:{items:rows.map(r=>({id:String(r.id),promocaoNome:r.promocaoNome,criadoEm:r.criado_em.toISOString(),status:r.status==='validado'?'confirmado':r.status})),limite:500}});
        }catch(e){v.erro(res,e);}finally{c?.release();}
    });return router;
};
