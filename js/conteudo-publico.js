'use strict';
(() => {
    const raiz=new URL('../',document.currentScript.src), cache=new Map();
    const criar=(tag,texto='',classe='')=>{const el=document.createElement(tag);el.textContent=texto;el.className=classe;return el;};
    const demo=location.protocol==='file:';
    function consultar(recurso){
        if(!cache.has(recurso))cache.set(recurso,(async()=>{
            const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
            try{const r=await fetch(new URL('api/public/'+recurso,raiz),{credentials:'omit',cache:'no-store',headers:{Accept:'application/json'},signal:ctrl.signal});if(!r.ok)throw new Error('Serviço indisponível');const b=await r.json();if(b.ok!==true||!b.data)throw new Error('Resposta inválida');return b.data;}
            finally{clearTimeout(timer);}
        })());return cache.get(recurso);
    }
    function imagem(caminho){
        if(!caminho)return '';try{const u=new URL(caminho,raiz);if(demo&&u.protocol==='file:'&&u.href.startsWith(raiz.href))return u.href;return u.origin===raiz.origin&&/^\/(?:images|uploads)\//.test(u.pathname)&&['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}
    }
    function aviso(host,texto){host.replaceChildren(criar('p',texto,'avisoModelo'));}
    window.conteudoCasa=Object.freeze({demo,raiz,consultar,criar,imagem,aviso});
    if(demo)return;
    const pagina=location.pathname==='/index.html'?'/':location.pathname;
    if(!['/','/paginas/blog.html','/paginas/cardapio.html','/paginas/galeria.html','/paginas/promocoes.html','/paginas/onde-comprar.html','/paginas/sobre.html'].includes(pagina))return;
    let origem='direto';
    try{if(document.referrer){const u=new URL(document.referrer);if(u.origin!==location.origin)origem=/(^|\.)instagram\.com$/.test(u.hostname)?'instagram':/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com)$/.test(u.hostname)?'busca':'referencia';}}catch{origem='desconhecido';}
    const dispositivo=window.innerWidth<=600?'celular':window.innerWidth<=1024?'tablet':'desktop';
    function registrar(evento){
        fetch(new URL('api/public/eventos',raiz),{method:'POST',credentials:'omit',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({evento,pagina,origem,dispositivo})}).catch(()=>{});
    }
    registrar('visualizacao');
    document.addEventListener('click',e=>{
        const a=e.target.closest('a[href]');if(!a)return;
        try{const h=new URL(a.href).hostname;const evento=/(^|\.)ifood\.com\.br$/.test(h)?'clique_ifood':h==='oia.99app.com'?'clique_99':h==='wa.me'||h==='api.whatsapp.com'?'clique_whatsapp':null;if(evento)registrar(evento);}catch{}
    });
})();
