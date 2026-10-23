'use strict';
// Ensaio manual autorizado: cria apenas fixtures identificadas e limpa suas próprias referências.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');
const sharp=require('sharp');
if(!process.argv.includes('--confirmar-banco-teste'))throw new Error('Confirme o banco de testes.');
process.env.NODE_ENV='test';
const pool=require('../database');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const token=crypto.randomBytes(32).toString('hex'),csrf=crypto.createHmac('sha256',token).update('churros-admin-csrf-v1').digest('hex');
const marca='ensaio-'+crypto.randomBytes(5).toString('hex');
const criados=[];let c,server,base,headers,midia,sessao=false,resgateId,metricasAntes,fotoLoja,etapa='início';let aprovados=0;
async function restaurarFoto(){
    if(!fotoLoja)return;
    const [atual]=await c.query('SELECT imagem_sobre_id,versao FROM loja WHERE id=?',[fotoLoja.id]);
    if(Number(atual.versao)===fotoLoja.versao&&String(atual.imagem_sobre_id)===String(fotoLoja.imagem_sobre_id)){fotoLoja=null;return;}
    assert.equal(Number(atual.versao),fotoLoja.versao+1);assert.equal(String(atual.imagem_sobre_id),midia.id);
    const r=await c.query('UPDATE loja SET imagem_sobre_id=?,alt_sobre=?,versao=versao+1,atualizado_em=NOW(3) WHERE id=? AND versao=?',[fotoLoja.imagem_sobre_id,fotoLoja.alt_sobre,fotoLoja.id,fotoLoja.versao+1]);assert.equal(Number(r.affectedRows),1);fotoLoja=null;
}
async function http(rota,method='GET',data,extras={}){
    const r=await fetch(base+rota,{method,headers:{...headers,...extras},body:data?JSON.stringify(data):undefined});
    const body=await r.json();return {status:r.status,body};
}
async function status(rota,method,data,esperado=200,extras){const r=await http(rota,method,data,extras);assert.equal(r.status,esperado,`${etapa}: ${rota}: ${JSON.stringify(r.body)}`);aprovados++;return r.body.data;}
async function criar(recurso,dados){const r=await status('/api/admin/'+recurso,'POST',dados);criados.push({recurso,id:r.id});return r;}
(async()=>{
    c=await pool.getConnection();const [amb]=await c.query('SELECT DATABASE() AS banco,CURRENT_USER() AS conta');assert.equal(amb.banco,'churros_em_casa_teste_017');assert.equal(amb.conta,'churros_app_teste@localhost');
    const [lock]=await c.query("SELECT GET_LOCK('churros_teste_017_modulos',0) AS obtido");assert.equal(Number(lock.obtido),1);
    const [relogio]=await c.query("SELECT NOW(3) AS data,DATE_FORMAT(NOW(3),'%Y-%m-%d %H:%i:%s.%f') AS texto");assert.equal(relogio.data.toISOString().slice(0,23).replace('T',' '),relogio.texto.slice(0,23));aprovados++;
    const [admin]=await c.query("SELECT id FROM administradores WHERE ativo=1 AND perfil='proprietario' LIMIT 1");assert(admin);
    await c.query('INSERT INTO sessoes_admin (administrador_id,token_hash,csrf_hash,expira_em) VALUES (?,?,?,DATE_ADD(NOW(3),INTERVAL 8 HOUR))',[admin.id,hash(token),hash(csrf)]);sessao=true;
    server=await new Promise((resolve,reject)=>{const s=require('../server').listen(0,'127.0.0.1',()=>resolve(s));s.once('error',reject);});base=`http://127.0.0.1:${server.address().port}`;headers={Origin:base,Cookie:`churros_admin=${token}`,'X-CSRF-Token':csrf,'Content-Type':'application/json'};
    etapa='autorização';for(const recurso of ['categorias','grupos','produtos','blog','galeria','cupons','midias','dashboard','resgates'])await status('/api/admin/'+recurso,'GET',null,401,{Cookie:''});
    await status('/api/admin/categorias','POST',{nome:'não criar'},403,{'X-CSRF-Token':''});
    etapa='upload inválido';
    const ruim=new FormData();ruim.append('arquivo',new Blob(['<svg/>'],{type:'image/png'}),'falso.png');
    let r=await fetch(base+'/api/admin/midias',{method:'POST',headers:{Origin:base,Cookie:headers.Cookie,'X-CSRF-Token':csrf},body:ruim});assert.equal(r.status,422);await r.arrayBuffer();aprovados++;
    etapa='upload válido';const png=await sharp({create:{width:4,height:4,channels:3,background:'#ce0505'}}).png().toBuffer();const form=new FormData();form.append('arquivo',new Blob([png],{type:'image/png'}),'teste.png');
    r=await fetch(base+'/api/admin/midias',{method:'POST',headers:{Origin:base,Cookie:headers.Cookie,'X-CSRF-Token':csrf},body:form});assert.equal(r.status,200);midia=(await r.json()).data;assert.match(midia.src,/^\/uploads\/[a-f0-9-]+\.webp$/);aprovados++;
    r=await fetch(base+midia.src);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/webp');const saida=await sharp(Buffer.from(await r.arrayBuffer())).metadata();assert.equal(saida.width,4);aprovados++;
    etapa='limites de upload';
    for(const [buffer,esperado] of [[Buffer.alloc(8*1024*1024+1),413],[await sharp({create:{width:8193,height:1,channels:3,background:'#ffffff'}}).png().toBuffer(),422]]){
        const f=new FormData();f.append('arquivo',new Blob([buffer],{type:'image/png'}),'limite.png');
        r=await fetch(base+'/api/admin/midias',{method:'POST',headers:{Origin:base,Cookie:headers.Cookie,'X-CSRF-Token':csrf},body:f});assert.equal(r.status,esperado);await r.arrayBuffer();aprovados++;
    }
    etapa='categoria e grupo';const catDados={nome:marca,slug:marca,status:'publicado',ordem:0,imagem:midia.src,alt:'Imagem de teste'};
    const cat=await criar('categorias',catDados);await status('/api/admin/categorias','POST',catDados,409);
    const grupo=await criar('grupos',{nome:marca,categoriaId:cat.id,ordem:0});
    etapa='produto';const produtoDados={nome:marca,descricao:'Fixture do ensaio',grupoId:grupo.id,preco:'12.30',imagem:midia.src,alt:'Fixture',disponivel:true,destaque:true,status:'rascunho',ordem:0};
    const produto=await criar('produtos',produtoDados);
    let catalogo=await status('/api/public/catalogo');assert(!JSON.stringify(catalogo).includes(marca));aprovados++;
    await status('/api/admin/produtos/'+produto.id,'PATCH',{status:'publicado',versao:1});
    await status('/api/admin/produtos/'+produto.id,'PUT',{...produtoDados,versao:1},409);
    catalogo=await status('/api/public/catalogo');assert(JSON.stringify(catalogo).includes(marca));assert.equal(catalogo.items.find(x=>x.id===cat.id).grupos[0].produtos[0].preco,'12.30');aprovados++;
    await status('/api/admin/categorias/'+cat.id,'DELETE',{versao:1},409);
    const cat2=await criar('categorias',{...catDados,nome:marca+'2',slug:marca+'2'});
    await status('/api/admin/grupos/'+grupo.id,'PUT',{nome:marca,categoriaId:cat2.id,ordem:0,versao:1},409);
    etapa='blog';const blog=await criar('blog',{titulo:marca,categoria:'Ensaio',resumo:'Fixture',paragrafos:['<script>texto inerte</script>'],imagem:midia.src,alt:'Fixture',status:'publicado',publicadoEm:'2026-01-01T12:30',link:'https://example.com/',textoLink:'Exemplo'});
    const posts=await status('/api/public/blog');assert(posts.items.some(p=>p.titulo===marca&&p.paragrafos[0]==='<script>texto inerte</script>'));aprovados++;
    const [dataSalva]=await c.query("SELECT DATE_FORMAT(publicado_em,'%Y-%m-%d %H:%i') AS utc FROM posts_blog WHERE id=?",[blog.id]);assert.equal(dataSalva.utc,'2026-01-01 15:30');assert.equal(posts.items.find(p=>p.titulo===marca).publicadoEm,'2026-01-01T15:30:00.000Z');aprovados++;
    etapa='galeria';await criar('galeria',{src:midia.src,alt:marca,legenda:'Fixture',status:'publicado',ordem:0});const fotos=await status('/api/public/galeria');assert(fotos.items.some(f=>f.alt===marca));aprovados++;
    etapa='cupons';const cupomDados={nome:marca,descricao:'Fixture',plataforma:'ambas',codigoIfood:'CODIGO-FICTICIO-IFOOD',codigo99:'CODIGO-FICTICIO-99',inicio:'2026-01-01T10:00',validade:'2099-12-31T22:00',limiteResgates:10,condicoes:'Somente ensaio, não válido nos aplicativos',status:'ativo'};
    const cupom=await criar('cupons',cupomDados);let cupons=await status('/api/public/cupons');const publico=cupons.items.find(x=>x.id===cupom.id);assert(publico);assert(!JSON.stringify(cupons).includes('CODIGO-FICTICIO'));aprovados++;
    const resgate=await c.query("INSERT INTO resgates (promocao_id,identificador_hash,status) VALUES (?,?,'validado')",[cupom.id,hash(marca)]);resgateId=resgate.insertId;
    await status('/api/admin/cupons/'+cupom.id,'PUT',{...cupomDados,codigoIfood:'OUTRO',versao:1},409);
    await status('/api/admin/cupons/'+cupom.id,'DELETE',{versao:1});
    cupons=await status('/api/public/cupons');assert(!cupons.items.some(x=>x.id===cupom.id));aprovados++;
    await status('/api/public/resgates','POST',{cupomId:cupom.id},409);
    if(!process.argv.includes('--aguardar-navegador')){
    etapa='imagem da Loja';const lojaForm=await status('/api/admin/loja');
    const [fotoAnterior]=await c.query('SELECT id,imagem_sobre_id,alt_sobre,versao FROM loja WHERE loja_unica=1');fotoLoja={...fotoAnterior,versao:Number(fotoAnterior.versao)};
    await status('/api/admin/loja','PUT',{...lojaForm,imagemSobre:midia.src,altSobre:'Foto temporária do ensaio'});
    const lojaPublica=await status('/api/public/loja');assert.equal(lojaPublica.imagemSobre,midia.src);assert.equal(lojaPublica.altSobre,'Foto temporária do ensaio');aprovados++;
    await restaurarFoto();aprovados++;
    }
    etapa='métricas';const [loja]=await c.query('SELECT metricas_inicio_em FROM loja WHERE loja_unica=1');const [clock]=await c.query('SELECT NOW(3) AS agora');const dia=require('../validacao').local(clock.agora).slice(0,10);
    const rows=await c.query("SELECT id,quantidade FROM metricas_dimensoes_diarias WHERE data_referencia=? AND evento='visualizacao' AND pagina='/' AND origem='desconhecido' AND dispositivo='desconhecido'",[dia]);metricasAntes={inicio:loja.metricas_inicio_em,dia,linha:rows[0]};
    await status('/api/public/eventos','POST',{evento:'visualizacao',pagina:'/',origem:'desconhecido',dispositivo:'desconhecido'});
    await status('/api/public/eventos','POST',{evento:'visualizacao',pagina:'/admin/',origem:'direto',dispositivo:'desktop'},422);
    for(const periodo of ['today','7d','30d','90d']){const d=await status('/api/admin/dashboard?period='+periodo);assert.equal(d.diario.length,periodo==='today'?1:Number(periodo.slice(0,-1)));assert(Number.isInteger(d.periodo.visualizacoes));aprovados++;}
    await status('/api/admin/dashboard?period=invalido','GET',null,422);
    const lista=await status('/api/admin/resgates?period=7d');assert(!JSON.stringify(lista).includes(hash(marca)));aprovados++;
    for(const recurso of ['categorias','grupos','produtos','blog','galeria','cupons'])await status('/api/admin/'+recurso);
    etapa='edições completas e concorrência';
    await status('/api/admin/categorias/'+cat.id,'PUT',{...catDados,versao:1});
    await status('/api/admin/grupos/'+grupo.id,'PUT',{nome:marca,categoriaId:cat.id,ordem:0,versao:1});
    await status('/api/admin/produtos/'+produto.id,'PUT',{...produtoDados,status:'publicado',versao:2});
    await status('/api/admin/blog/'+blog.id,'PUT',{titulo:marca,categoria:'Ensaio',resumo:'Fixture atualizada',paragrafos:['<script>texto inerte</script>'],imagem:midia.src,alt:'Fixture',status:'publicado',publicadoEm:'2026-01-01T12:30',link:'',textoLink:'',versao:1});
    const fotoCriada=criados.find(x=>x.recurso==='galeria');await status('/api/admin/galeria/'+fotoCriada.id,'PUT',{src:midia.src,alt:marca,legenda:'Fixture atualizada',status:'publicado',ordem:0,versao:1});
    const paralelo=await Promise.all([http('/api/admin/produtos/'+produto.id,'PATCH',{status:'publicado',versao:3}),http('/api/admin/produtos/'+produto.id,'PATCH',{status:'publicado',versao:3})]);assert.deepEqual(paralelo.map(r=>r.status).sort(),[200,409]);aprovados++;
    await status('/api/admin/categorias/'+cat2.id,'DELETE',{versao:1});await status('/api/admin/categorias/'+cat2.id,'DELETE',{versao:1},404);
    await status('/api/admin/cupons/'+cupom.id,'PUT',{...cupomDados,versao:2},409);
    console.log(JSON.stringify({resultado:'APROVADO',verificacoes:aprovados,fixtures:marca,banco:amb.banco,autenticacao:'sessão temporária real; sem alteração de senha',limpeza:'no bloco finally'}));
    if(process.argv.includes('--aguardar-navegador')){
        await criar('cupons',{...cupomDados,nome:marca+'-preview'});
        const sinal=path.join(__dirname,'../var',marca+'.continuar');
        console.log('PREVIA_TEMPORARIA_PRONTA; crie o arquivo '+sinal+' para concluir e limpar. Limite: dez minutos.');
        await new Promise((resolve,reject)=>{
            let intervalo,limite;
            const sair=()=>encerrar();
            const encerrar=e=>{clearInterval(intervalo);clearTimeout(limite);process.removeListener('SIGINT',sair);e?reject(e):resolve();};
            intervalo=setInterval(()=>fs.access(sinal).then(()=>encerrar()).catch(()=>{}),250);
            limite=setTimeout(()=>encerrar(new Error('TEMPO_DE_PREVIA_ESGOTADO')),600000);
            process.once('SIGINT',sair);
        });
        await fs.unlink(sinal).catch(()=>{});
    }
})().catch(e=>{console.error('ENSAIO_FALHOU',etapa,e.code||e.name,e.code?'':e.message);process.exitCode=1;}).finally(async()=>{
    if(c){try{
        await restaurarFoto();
        if(resgateId)await c.query('DELETE FROM resgates WHERE id=?',[resgateId]);
        const tabelas={galeria:'galeria',blog:'posts_blog',produtos:'produtos',grupos:'grupos_cardapio',categorias:'categorias_cardapio',cupons:'promocoes'};
        for(const recurso of ['galeria','blog','produtos','grupos','categorias','cupons'])for(const item of criados.filter(x=>x.recurso===recurso)){
            await c.query('DELETE FROM auditoria_admin WHERE entidade=? AND entidade_id=?',[recurso,item.id]);await c.query(`DELETE FROM ${tabelas[recurso]} WHERE id=?`,[item.id]);
        }
        if(midia){await c.query('DELETE FROM midias WHERE id=? AND caminho_arquivo=?',[midia.id,midia.src]);await fs.unlink(path.join(__dirname,'../var/uploads',path.basename(midia.src))).catch(()=>{});}
        if(metricasAntes){const m=metricasAntes;
            if(m.linha)await c.query('UPDATE metricas_dimensoes_diarias SET quantidade=? WHERE id=?',[m.linha.quantidade,m.linha.id]);
            else await c.query("DELETE FROM metricas_dimensoes_diarias WHERE data_referencia=? AND evento='visualizacao' AND pagina='/' AND origem='desconhecido' AND dispositivo='desconhecido'",[m.dia]);
            const [r]=await c.query('SELECT COUNT(*) AS n FROM metricas_dimensoes_diarias');if(m.inicio||!Number(r.n))await c.query('UPDATE loja SET metricas_inicio_em=? WHERE loja_unica=1',[m.inicio]);
        }
        if(sessao)await c.query('DELETE FROM sessoes_admin WHERE token_hash=?',[hash(token)]);
        await c.query("SELECT RELEASE_LOCK('churros_teste_017_modulos')");console.log('LIMPEZA_CONCLUIDA');
    }catch(e){console.error('LIMPEZA_EXIGE_REVISAO',e.code||e.name);process.exitCode=1;}finally{c.release();}}
    if(server)await new Promise(resolve=>server.close(resolve));await pool.end();
});
