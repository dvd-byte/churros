'use strict';
(async()=>{
    const {demo,consultar,criar,imagem,aviso}=window.conteudoCasa;if(demo)return;
    const vitrine=document.querySelector('.vitrine'),destaques=document.querySelector('.destaques .containeres'),cards=document.querySelector('.comidas .cards');
    if(!vitrine&&!destaques)return;
    let host;
    if(vitrine){host=criar('div');host.id='catalogoDinamico';vitrine.querySelectorAll('.secaoCardapio').forEach(s=>s.remove());vitrine.append(host);aviso(host,'Carregando cardápio…');}
    if(destaques)aviso(destaques,'Carregando destaques…');
    if(cards)aviso(cards,'Carregando categorias…');
    document.querySelector('.destaques .notaDemonstracao')?.remove();
    let categorias;try{categorias=(await consultar('catalogo')).items;}catch{if(host)aviso(host,'Cardápio temporariamente indisponível.');if(destaques)aviso(destaques,'Destaques temporariamente indisponíveis.');if(cards)aviso(cards,'Categorias temporariamente indisponíveis.');return;}
    if(cards){cards.replaceChildren();for(const cat of categorias){const bloco=criar('div','','bloco'),conteudo=criar('div','','conteudo'),src=imagem(cat.imagem);if(src){const img=criar('img');img.src=src;img.alt=cat.alt;img.loading='lazy';bloco.append(img);}conteudo.append(criar('span','CARDÁPIO','categoria'),criar('h3',cat.nome));const a=criar('a','Ver cardápio','botaoCardapio');a.href=new URL('paginas/cardapio.html#'+encodeURIComponent(cat.slug),window.conteudoCasa.raiz);conteudo.append(a);bloco.append(conteudo);cards.append(bloco);}if(!categorias.length)aviso(cards,'Ainda não há categorias com produtos publicados.');}
    const moeda=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v));
    if(vitrine){
        host.replaceChildren();const atalhos=vitrine.querySelector('.categoriasVitrine'),filtro=document.getElementById('filtroCategoria');atalhos.replaceChildren();filtro.replaceChildren(criar('option','Todas as categorias'));filtro.firstChild.value='';
        for(const cat of categorias){
            const opt=criar('option',cat.nome);opt.value=cat.slug;filtro.append(opt);
            const a=criar('a','','atalhoCategoria');a.href='#'+encodeURIComponent(cat.slug);const src=imagem(cat.imagem);
            if(src){const img=criar('img');img.src=src;img.alt='';img.loading='lazy';a.append(img);}else a.classList.add('semFoto');a.append(criar('span',cat.nome));atalhos.append(a);
            const sec=criar('section','','secaoCardapio');sec.id=cat.slug;sec.dataset.categoria=cat.slug;const head=criar('div','','cabecalhoCategoria');head.append(criar('h2',cat.nome));sec.append(head);
            const grupos=criar('div','','gruposProdutos');for(const g of cat.grupos){const grupo=criar('section','','grupoProdutos');grupo.append(criar('h3',g.nome));const ul=criar('ul','','listaProdutos');
                for(const p of g.produtos){const li=criar('li','','produto');li.dataset.busca=[cat.nome,g.nome,p.nome,p.descricao].join(' ');const texto=criar('div');texto.append(criar('h4',p.nome));if(p.descricao)texto.append(criar('p',p.descricao));if(!p.disponivel)texto.append(criar('small','Indisponível no momento'));li.append(texto,criar('span',moeda(p.preco),'valorProduto'));ul.append(li);}grupo.append(ul);grupos.append(grupo);
            }sec.append(grupos);host.append(sec);
        }
        if(!categorias.length)aviso(host,'Ainda não há produtos publicados.');
        document.dispatchEvent(new Event('catalogo:atualizado'));
    }
    if(destaques){
        destaques.replaceChildren();const produtos=categorias.flatMap(c=>c.grupos.flatMap(g=>g.produtos)).filter(p=>p.destaque&&p.disponivel).slice(0,6);
        for(const p of produtos){const card=criar('article','','container'),cima=criar('div','','cima'),baixo=criar('div','','baixo');const src=imagem(p.imagem);
            if(src){const img=criar('img');img.src=src;img.alt=p.alt;img.loading='lazy';cima.append(img);}const centro=criar('div','','centro');centro.append(criar('h4',p.nome));cima.append(centro);baixo.append(criar('h5',p.nome),criar('p',p.descricao),criar('p',moeda(p.preco),'preco'));
            const a=criar('a','Ver no cardápio ↗','botaoDelivery');a.href=new URL('paginas/cardapio.html',window.conteudoCasa.raiz);baixo.append(a);card.append(cima,baixo);destaques.append(card);
        }if(!produtos.length)aviso(destaques,'Ainda não há destaques publicados.');
    }
})();
