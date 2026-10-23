'use strict';
const express=require('express');
const multer=require('multer');
const sharp=require('sharp');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {rateLimit}=require('express-rate-limit');
const pool=require('./database');
const v=require('./validacao');
const pasta=path.join(__dirname,'var','uploads');
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1,fields:0,parts:1}}).single('arquivo');
let processando=0;
module.exports=({autenticar,csrf,proprietario})=>{
    const router=express.Router();
    router.use('/midias',autenticar,proprietario);
    router.get('/midias',async(req,res)=>{
        let c;try{c=await pool.getConnection();const rows=await c.query('SELECT id,caminho_arquivo,largura_px,altura_px FROM midias ORDER BY id DESC LIMIT 200');res.json({ok:true,data:{items:rows.map(m=>({id:String(m.id),src:m.caminho_arquivo,largura:m.largura_px,altura:m.altura_px}))}});}catch(e){v.erro(res,e);}finally{c?.release();}
    });
    router.post('/midias',csrf,rateLimit({windowMs:15*60000,limit:20,standardHeaders:'draft-8',legacyHeaders:false,message:{ok:false,data:null}}),async(req,res)=>{
        if(processando>=2)return res.status(429).json({ok:false,data:null,mensagem:'Há imagens sendo processadas. Tente novamente em instantes.'});
        processando++;let c,arquivo,commitTentado=false;
        try{
            await new Promise((resolve,reject)=>upload(req,res,e=>e?reject(e):resolve()));
            v.exigir(req.file&&['image/jpeg','image/png','image/webp'].includes(req.file.mimetype),'Envie JPG, PNG ou WebP.');
            const b=req.file.buffer;
            const assinatura=b.subarray(0,3).equals(Buffer.from([255,216,255]))||b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP');
            v.exigir(assinatura,'O arquivo não é uma imagem permitida.');
            let meta,imagem;
            try{
                meta=await sharp(b,{limitInputPixels:25000000,failOn:'warning'}).metadata();
                v.exigir(['jpeg','png','webp'].includes(meta.format)&&(!meta.pages||meta.pages===1)&&meta.width<=8192&&meta.height<=8192,'Use uma imagem estática de até 8192 pixels por lado.');
                imagem=await sharp(b,{limitInputPixels:25000000,failOn:'warning'}).rotate().resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer({resolveWithObject:true});
            }catch(e){if(e instanceof v.ErroHttp)throw e;throw new v.ErroHttp(422,'Não foi possível decodificar a imagem.');}
            const nome=crypto.randomUUID()+'.webp',src='/uploads/'+nome;
            await fs.mkdir(pasta,{recursive:true});arquivo=path.join(pasta,nome);await fs.writeFile(arquivo,imagem.data,{flag:'wx'});
            c=await pool.getConnection();
            await c.beginTransaction();
            const r=await c.query('INSERT INTO midias (nome_arquivo,caminho_arquivo,tipo_mime,tamanho_bytes,largura_px,altura_px,criado_por) VALUES (?,?,?,?,?,?,?)',[nome,src,'image/webp',imagem.data.length,imagem.info.width,imagem.info.height,req.admin.id]);
            commitTentado=true;await c.commit();arquivo=null;res.json({ok:true,data:{id:String(r.insertId),src}});
        }catch(e){if(c)await c.rollback().catch(()=>{});if(arquivo&&!commitTentado)await fs.unlink(arquivo).catch(()=>{});if(e instanceof multer.MulterError)return res.status(e.code==='LIMIT_FILE_SIZE'?413:422).json({ok:false,data:null,mensagem:'Envie somente uma imagem JPG, PNG ou WebP de até 8 MB.'});v.erro(res,e);}
        finally{c?.release();processando--;}
    });
    return router;
};
module.exports.pasta=pasta;
