'use strict';
const v=require('./validacao');
const paginas=['/','/paginas/blog.html','/paginas/cardapio.html','/paginas/galeria.html','/paginas/promocoes.html','/paginas/onde-comprar.html','/paginas/sobre.html'];
const periodos={today:1,'7d':7,'30d':30,'90d':90};
function deslocar(d,n){return new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);}
async function periodo(c,chave){
    v.exigir(Object.hasOwn(periodos,chave),'Período inválido.');
    const [r]=await c.query('SELECT NOW(3) AS agora');const hoje=v.local(r.agora).slice(0,10),inicio=deslocar(hoje,1-periodos[chave]);
    return {hoje,inicio,fim:deslocar(hoje,1),agora:r.agora,dias:periodos[chave]};
}
async function dashboard(c,chave){
    const p=await periodo(c,chave);
    const [loja]=await c.query('SELECT id,link_ifood,link_99food,whatsapp_url,metricas_inicio_em FROM loja WHERE loja_unica=1');
    const [atual]=await c.query(`SELECT
        (SELECT COUNT(*) FROM galeria WHERE status='publicado') AS fotosPublicadas,
        (SELECT COUNT(*) FROM posts_blog WHERE status='publicado' AND publicado_em<=NOW(3)) AS postsPublicados,
        (SELECT COUNT(*) FROM promocoes t WHERE t.status='ativo' AND t.arquivada_em IS NULL AND t.inicio_em<=NOW(3) AND t.termina_em>NOW(3) AND (t.limite_usos IS NULL OR t.limite_usos>(SELECT COUNT(*) FROM resgates r WHERE r.promocao_id=t.id AND r.status='validado'))) AS cuponsAtivos,
        (SELECT COUNT(*) FROM promocoes t WHERE t.status='ativo' AND t.arquivada_em IS NULL AND t.inicio_em<=NOW(3) AND t.termina_em>NOW(3) AND t.termina_em<=DATE_ADD(NOW(3),INTERVAL 7 DAY) AND (t.limite_usos IS NULL OR t.limite_usos>(SELECT COUNT(*) FROM resgates r WHERE r.promocao_id=t.id AND r.status='validado'))) AS cuponsVencendo,
        (SELECT COUNT(*) FROM produtos p JOIN grupos_cardapio g ON g.id=p.grupo_id AND g.categoria_id=p.categoria_id JOIN categorias_cardapio c ON c.id=p.categoria_id WHERE p.status='publicado' AND c.status='publicado' AND g.ativo=1) AS produtosPublicados`);
    const resgates=await c.query("SELECT criado_em FROM resgates WHERE status='validado' AND criado_em>=? AND criado_em<?",[v.data(p.inicio+'T00:00','início'),v.data(p.fim+'T00:00','fim')]);
    const diario=Array.from({length:p.dias},(_,i)=>({data:deslocar(p.inicio,i),visualizacoes:0,resgates:0}));
    for(const r of resgates){const d=diario.find(d=>d.data===v.local(r.criado_em).slice(0,10));if(d)d.resgates++;}
    const coleta=!!loja?.metricas_inicio_em;
    const totais={visualizacoes:coleta?0:null,cliquesIfood:coleta?0:null,cliques99:coleta?0:null,cliquesWhatsapp:coleta?0:null,resgates:resgates.length};
    let ranking=null,audiencia={origemPredominante:null,dispositivoPredominante:null};
    if(coleta){
        const m=await c.query('SELECT data_referencia,evento,pagina,origem,dispositivo,quantidade FROM metricas_dimensoes_diarias WHERE data_referencia>=? AND data_referencia<=?',[p.inicio,p.hoje]);
        const eventos={visualizacao:'visualizacoes',clique_ifood:'cliquesIfood',clique_99:'cliques99',clique_whatsapp:'cliquesWhatsapp'},pag=new Map(),origens=new Map(),dispositivos=new Map();
        for(const r of m){const n=Number(r.quantidade);totais[eventos[r.evento]]+=n;if(r.evento!=='visualizacao')continue;
            const d=diario.find(d=>d.data===String(r.data_referencia).slice(0,10)||d.data===new Date(r.data_referencia).toISOString().slice(0,10));if(d)d.visualizacoes+=n;
            pag.set(r.pagina,(pag.get(r.pagina)||0)+n);origens.set(r.origem,(origens.get(r.origem)||0)+n);dispositivos.set(r.dispositivo,(dispositivos.get(r.dispositivo)||0)+n);
        }
        ranking=[...pag].map(([caminho,visualizacoes])=>({caminho,visualizacoes})).sort((a,b)=>b.visualizacoes-a.visualizacoes||a.caminho.localeCompare(b.caminho)).slice(0,6);
        const maior=m=>[...m].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]??null;
        audiencia={origemPredominante:maior(origens),dispositivoPredominante:maior(dispositivos)};
    }
    const horarios=loja?await c.query('SELECT dia_semana,hora_abertura,hora_fechamento,fechado FROM horarios_semanais WHERE loja_id=?',[loja.id]):[];
    const partes=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(p.agora).map(x=>[x.type,x.value]));
    const hoje=horarios.find(h=>Number(h.dia_semana)==={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[partes.weekday]);
    const hora=`${partes.hour}:${partes.minute}:${partes.second}`;
    const estado=hoje?(hoje.fechado?'fechada':hora>=hoje.hora_abertura&&hora<hoje.hora_fechamento?'aberta':'fechada'):null;
    const configurado=s=>{try{const u=new URL(s);return ['http:','https:'].includes(u.protocol);}catch{return false;}};
    return {periodo:totais,atual:Object.fromEntries(['fotosPublicadas','postsPublicados','cuponsAtivos','cuponsVencendo'].map(k=>[k,Number(atual[k])])),diario:diario.map(d=>({...d,visualizacoes:coleta?d.visualizacoes:null})),paginasMaisAcessadas:ranking,audiencia,
        operacao:{produtosPublicados:Number(atual.produtosPublicados),ifoodConfigurado:loja?configurado(loja.link_ifood):null,food99Configurado:loja?configurado(loja.link_99food):null,whatsappConfigurado:loja?configurado(loja.whatsapp_url):null,horariosConfigurados:loja?horarios.length===7:null,estadoLoja:estado},
        cobertura:{inicio:loja?.metricas_inicio_em?.toISOString()??null,parcial:coleta&&loja.metricas_inicio_em>v.data(p.inicio+'T00:00','início')}};
}
module.exports={paginas,periodo,dashboard};
