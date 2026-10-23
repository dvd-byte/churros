'use strict';
const express=require('express');
const pool=require('./database');
const {estadoCupom}=require('./conteudo');
const {paginas}=require('./metricas');
const v=require('./validacao');
const {rateLimit}=require('express-rate-limit');
const router=express.Router();
router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
const tratar=fn=>async(req,res)=>{let c;try{c=await pool.getConnection();await c.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');const data=await fn(c);await c.commit();res.json({ok:true,data});}catch{if(c)await c.rollback().catch(()=>{});res.status(503).json({ok:false,data:null});}finally{c?.release();}};
router.get('/catalogo',tratar(async c=>{
    const rows=await c.query(`SELECT c.id AS categoria_id,c.nome AS categoria,c.slug,c.alt AS categoria_alt,cm.caminho_arquivo AS categoria_imagem,
        g.id AS grupo_id,g.nome AS grupo,p.id,p.nome,p.descricao,p.preco,p.disponivel,p.destaque,p.alt,m.caminho_arquivo AS imagem
        FROM categorias_cardapio c JOIN grupos_cardapio g ON g.categoria_id=c.id AND g.ativo=1
        JOIN produtos p ON p.grupo_id=g.id AND p.categoria_id=c.id AND p.status='publicado'
        LEFT JOIN midias m ON m.id=p.imagem_id LEFT JOIN midias cm ON cm.id=c.imagem_id
        WHERE c.status='publicado' ORDER BY c.ordem,c.id,g.ordem,g.id,p.ordem,p.id`);
    const cats=new Map();
    for(const r of rows){const key=String(r.categoria_id);if(!cats.has(key))cats.set(key,{id:key,nome:r.categoria,slug:r.slug,imagem:r.categoria_imagem??'',alt:r.categoria_alt??'',grupos:[]});const cat=cats.get(key);
        let grupo=cat.grupos.find(g=>g.id===String(r.grupo_id));if(!grupo){grupo={id:String(r.grupo_id),nome:r.grupo,produtos:[]};cat.grupos.push(grupo);}
        grupo.produtos.push({id:String(r.id),nome:r.nome,descricao:r.descricao??'',preco:String(r.preco),disponivel:!!r.disponivel,destaque:!!r.destaque,imagem:r.imagem??'',alt:r.alt??''});
    }return {items:[...cats.values()]};
}));
router.get('/blog',tratar(async c=>{
    const rows=await c.query("SELECT p.id,p.slug,p.titulo,p.categoria,p.resumo,p.paragrafos_json,p.alt,p.link,p.texto_link,p.publicado_em,m.caminho_arquivo AS imagem FROM posts_blog p LEFT JOIN midias m ON m.id=p.imagem_id WHERE p.status='publicado' AND p.publicado_em<=NOW(3) ORDER BY p.publicado_em DESC,p.id DESC");
    return {items:rows.map(r=>{
        const paragrafos=Array.isArray(r.paragrafos_json)?r.paragrafos_json:JSON.parse(r.paragrafos_json??'null');
        if(!Array.isArray(paragrafos)||paragrafos.some(x=>typeof x!=='string'))throw new Error('Conteudo legado');
        let link='';try{link=v.url(r.link,'link');}catch{}
        return {id:r.slug,titulo:r.titulo,categoria:r.categoria??'',resumo:r.resumo??'',paragrafos,alt:r.alt??'',imagem:r.imagem??'',link,textoLink:r.texto_link??'',publicadoEm:r.publicado_em.toISOString()};
    })};
}));
router.get('/galeria',tratar(async c=>({items:(await c.query("SELECT m.caminho_arquivo AS src,g.texto_alternativo AS alt,g.legenda FROM galeria g JOIN midias m ON m.id=g.midia_id WHERE g.status='publicado' AND TRIM(COALESCE(g.texto_alternativo,''))<>'' ORDER BY g.ordem,g.id")).map(r=>({src:r.src,alt:r.alt,legenda:r.legenda??''}))})));
router.get('/cupons',tratar(async c=>({items:(await c.query(`SELECT t.id,t.titulo,t.descricao,t.plataforma,t.condicoes,t.status,t.arquivada_em,t.termina_em,t.limite_usos,
    (t.termina_em<=NOW(3)) AS expirado,(t.inicio_em>NOW(3)) AS futuro,
    (SELECT COUNT(*) FROM resgates r WHERE r.promocao_id=t.id AND r.status='validado') AS usos
    FROM promocoes t WHERE t.status='ativo' AND t.arquivada_em IS NULL AND t.inicio_em<=NOW(3) ORDER BY t.termina_em,t.id`)).map(r=>({id:String(r.id),nome:r.titulo,descricao:r.descricao??'',plataforma:r.plataforma,condicoes:r.condicoes??'',validade:r.termina_em.toISOString(),status:estadoCupom(r)}))})));
router.post('/resgates',(req,res)=>res.status(409).json({ok:false,data:null,mensagem:'O resgate no site ainda não está habilitado.'}));
router.post('/eventos',rateLimit({windowMs:60000,limit:90,standardHeaders:'draft-8',legacyHeaders:false,message:{ok:false,data:null}}),async(req,res)=>{
    let c;try{
        v.exigir(req.get('origin')===`${req.protocol}://${req.get('host')}`,'Origem não permitida.',403);
        const b=req.body??{};v.exigir(Object.keys(b).every(k=>['evento','pagina','origem','dispositivo'].includes(k)),'Evento inválido.');
        const evento=v.opcao(b.evento,['visualizacao','clique_ifood','clique_99','clique_whatsapp'],'evento');
        const pagina=v.opcao(b.pagina,paginas,'página');const origem=v.opcao(b.origem,['direto','instagram','busca','referencia','desconhecido'],'origem');
        const dispositivo=v.opcao(b.dispositivo,['celular','tablet','desktop','desconhecido'],'dispositivo');
        c=await pool.getConnection();await c.beginTransaction();const [l]=await c.query('SELECT id FROM loja WHERE loja_unica=1 FOR UPDATE');v.exigir(l,'Loja indisponível.',404);
        const [t]=await c.query('SELECT NOW(3) AS agora');const dia=v.local(t.agora).slice(0,10);
        await c.query('INSERT INTO metricas_dimensoes_diarias (data_referencia,evento,pagina,origem,dispositivo,quantidade) VALUES (?,?,?,?,?,1) ON DUPLICATE KEY UPDATE quantidade=quantidade+1',[dia,evento,pagina,origem,dispositivo]);
        await c.query('UPDATE loja SET metricas_inicio_em=COALESCE(metricas_inicio_em,NOW(3)) WHERE id=?',[l.id]);
        await c.commit();res.json({ok:true,data:{registrado:true}});
    }catch(e){if(c)await c.rollback().catch(()=>{});v.erro(res,e);}finally{c?.release();}
});
module.exports=router;
