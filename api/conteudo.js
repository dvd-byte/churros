'use strict';
const crypto = require('node:crypto');
const v = require('./validacao');
const specs = {
    categorias: {tabela:'categorias_cardapio', colunas:'t.id,t.nome,t.slug,t.status,t.ordem,t.alt,t.versao', midia:'imagem_id'},
    grupos: {tabela:'grupos_cardapio',colunas:'t.id,t.nome,t.categoria_id,t.ordem,t.versao,t.ativo'},
    produtos: {tabela:'produtos',colunas:'t.id,t.nome,t.descricao,t.grupo_id,t.categoria_id,t.preco,t.disponivel,t.destaque,t.status,t.ordem,t.alt,t.versao',midia:'imagem_id'},
    blog: {tabela:'posts_blog',colunas:'t.id,t.titulo,t.slug,t.categoria,t.resumo,t.paragrafos_json,t.status,t.publicado_em,t.link,t.texto_link,t.alt,t.versao',midia:'imagem_id'},
    galeria: {tabela:'galeria',colunas:'t.id,t.texto_alternativo,t.legenda,t.status,t.ordem,t.versao',midia:'midia_id'},
    cupons: {tabela:'promocoes',colunas:'t.id,t.titulo,t.descricao,t.plataforma,t.codigo_ifood,t.codigo_99,t.inicio_em,t.termina_em,t.limite_usos,t.condicoes,t.status,t.arquivada_em,t.versao'}
};
const base = r => ({id:String(r.id),versao:Number(r.versao)});
function estadoCupom(r) {
    if (r.arquivada_em || r.status !== 'ativo') return 'inativo';
    if (Number(r.expirado)) return 'expirado';
    if (r.limite_usos != null && Number(r.usos) >= Number(r.limite_usos)) return 'esgotado';
    if (Number(r.futuro)) return 'agendado'; return 'ativo';
}
function mapear(recurso,r) {
    const b = base(r), imagem = r.imagem ?? '';
    if (recurso === 'categorias') return {...b,nome:r.nome,slug:r.slug,status:r.status,ordem:r.ordem,imagem,alt:r.alt??''};
    if (recurso === 'grupos') return {...b,nome:r.nome,categoriaId:String(r.categoria_id),ordem:r.ordem};
    if (recurso === 'produtos') return {...b,nome:r.nome,descricao:r.descricao??'',grupoId:String(r.grupo_id),preco:String(r.preco),disponivel:!!r.disponivel,destaque:!!r.destaque,status:r.status,ordem:r.ordem,imagem,alt:r.alt??''};
    if (recurso === 'galeria') return {...b,src:imagem,alt:r.texto_alternativo??'',legenda:r.legenda??'',status:r.status,ordem:r.ordem};
    if (recurso === 'blog') {
        let p; try { p=Array.isArray(r.paragrafos_json)?r.paragrafos_json:JSON.parse(r.paragrafos_json??'null'); } catch { p=null; }
        v.exigir(Array.isArray(p)&&p.every(x=>typeof x==='string'), 'Publicação legada precisa ter seus parágrafos revisados antes de editar.',409);
        return {...b,titulo:r.titulo,categoria:r.categoria??'',resumo:r.resumo??'',paragrafos:p,status:r.status==='arquivado'?'inativo':r.status,publicadoEm:v.local(r.publicado_em),link:r.link??'',textoLink:r.texto_link??'',imagem,alt:r.alt??''};
    }
    return {...b,nome:r.titulo,descricao:r.descricao??'',plataforma:r.plataforma??'',codigoIfood:r.codigo_ifood??'',codigo99:r.codigo_99??'',inicio:v.local(r.inicio_em),validade:v.local(r.termina_em),limiteResgates:r.limite_usos,condicoes:r.condicoes??'',status:r.status,statusCalculado:estadoCupom(r),arquivado:!!r.arquivada_em};
}
function select(recurso) {
    const s=specs[recurso];
    return `SELECT ${s.colunas}${s.midia?',m.caminho_arquivo AS imagem':''}${recurso==='cupons'?",(SELECT COUNT(*) FROM resgates r WHERE r.promocao_id=t.id AND r.status='validado') AS usos,(t.termina_em <= NOW(3)) AS expirado,(t.inicio_em > NOW(3)) AS futuro":''} FROM ${s.tabela} t${s.midia?` LEFT JOIN midias m ON m.id=t.${s.midia}`:''}`;
}
async function midia(c,caminho,obrigatoria=false) {
    const s=v.texto(caminho,'imagem',500,obrigatoria); if(!s) return null;
    const [m]=await c.query('SELECT id FROM midias WHERE caminho_arquivo=? LIMIT 1',[s]);
    v.exigir(m,'Envie uma imagem pelo serviço de mídia ou use uma referência já cadastrada.'); return m.id;
}
async function dados(recurso,b,c,atual) {
    const out={};
    if(['categorias','grupos','produtos'].includes(recurso)) out.nome=v.texto(b.nome,'nome',recurso==='produtos'?150:100,true);
    if(['categorias','grupos','produtos','galeria'].includes(recurso)) out.ordem=v.inteiro(b.ordem??0,'ordem');
    if(['categorias','produtos','blog','galeria'].includes(recurso)) out.status=v.opcao(b.status,['rascunho','publicado','inativo'],'publicação');
    if(['categorias','produtos','blog'].includes(recurso)) {
        out.imagem_id=await midia(c,b.imagem); out.alt=v.texto(b.alt,'descrição da imagem',500);v.exigir(!out.imagem_id||out.alt,'Preencha a descrição da imagem.');
    }
    if(recurso==='categorias') {out.slug=v.texto(b.slug,'slug',160,true);v.exigir(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(out.slug),'Use slug com letras minúsculas, números e hífens.');out.ativa=out.status==='publicado'?1:0;}
    if(recurso==='grupos') {
        out.categoria_id=v.id(b.categoriaId);const [cat]=await c.query('SELECT id FROM categorias_cardapio WHERE id=? FOR UPDATE',[out.categoria_id]);v.exigir(cat,'Categoria não encontrada.');
        if(atual&&String(atual.categoria_id)!==out.categoria_id) {const [p]=await c.query('SELECT id FROM produtos WHERE grupo_id=? LIMIT 1',[atual.id]);v.exigir(!p,'O grupo possui produtos e não pode mudar de categoria neste fluxo.',409);}
        if(!atual) out.ativo=1;
    }
    if(recurso==='produtos') {
        out.grupo_id=v.id(b.grupoId);const [g]=await c.query('SELECT id,categoria_id FROM grupos_cardapio WHERE id=? FOR UPDATE',[out.grupo_id]);v.exigir(g,'Grupo não encontrado.');
        out.categoria_id=g.categoria_id;out.descricao=v.texto(b.descricao,'descrição',10000);out.preco=v.preco(b.preco);out.disponivel=v.booleano(b.disponivel,'disponibilidade');out.destaque=v.booleano(b.destaque,'destaque');
    }
    if(recurso==='blog') {
        out.titulo=v.texto(b.titulo,'título',200,true);out.categoria=v.texto(b.categoria,'categoria',100,true);out.resumo=v.texto(b.resumo,'resumo',10000,true);
        const p=v.paragrafos(b.paragrafos);out.paragrafos_json=JSON.stringify(p);out.conteudo=p.join('\n\n');out.publicado_em=v.data(b.publicadoEm,'data de publicação');
        if(out.status==='publicado'&&!out.publicado_em){const [r]=await c.query('SELECT NOW(3) AS agora');out.publicado_em=r.agora;}
        out.link=v.url(b.link,'link');out.texto_link=v.texto(b.textoLink,'texto do link',180);v.exigir(!out.link||out.texto_link,'Preencha o texto do link.');
        if(!atual) out.slug=(out.titulo.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,160)||'post')+'-'+crypto.randomBytes(8).toString('hex');
    }
    if(recurso==='galeria') {out.midia_id=await midia(c,b.src,true);out.texto_alternativo=v.texto(b.alt,'descrição da foto',500,true);out.legenda=v.texto(b.legenda,'legenda',10000);out.publicada=out.status==='publicado'?1:0;}
    if(recurso==='cupons') {
        v.exigir(!atual?.arquivada_em,'Campanha arquivada não pode ser alterada.',409);
        out.titulo=v.texto(b.nome,'nome',200,true);out.descricao=v.texto(b.descricao,'descrição',10000,true);out.plataforma=v.opcao(b.plataforma,['ifood','99food','ambas'],'plataforma');
        out.codigo_ifood=v.texto(b.codigoIfood,'código iFood',255)||null;out.codigo_99=v.texto(b.codigo99,'código 99 Food',255)||null;
        out.inicio_em=v.data(b.inicio,'início',true);out.termina_em=v.data(b.validade,'término',true);v.exigir(out.termina_em>out.inicio_em,'Término deve ser posterior ao início.');
        out.limite_usos=b.limiteResgates==null?null:v.inteiro(b.limiteResgates,'limite',1,4294967295);out.condicoes=v.texto(b.condicoes,'condições',10000,true);
        out.status=v.opcao(b.status,['rascunho','ativo','inativo'],'estado');out.ativa=out.status==='ativo'?1:0;
        v.exigir(!['ifood','ambas'].includes(out.plataforma)||out.codigo_ifood,'Informe o código iFood.');v.exigir(!['99food','ambas'].includes(out.plataforma)||out.codigo_99,'Informe o código 99 Food.');
        if(atual) {
            const [r]=await c.query('SELECT COUNT(*) AS n FROM resgates WHERE promocao_id=?',[atual.id]);
            if(Number(r.n)) {
                v.exigir(atual.plataforma===out.plataforma&&atual.codigo_ifood===out.codigo_ifood&&atual.codigo_99===out.codigo_99,'Campanha com resgates não permite alterar códigos ou plataformas.',409);
                const [u]=await c.query("SELECT COUNT(*) AS n FROM resgates WHERE promocao_id=? AND status='validado'",[atual.id]);v.exigir(out.limite_usos==null||out.limite_usos>=Number(u.n),'Limite inferior aos resgates existentes.',409);
            }
        }
    }
    return out;
}
module.exports={specs,mapear,select,midia,dados,estadoCupom};
