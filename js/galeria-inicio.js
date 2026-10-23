'use strict';
(async()=>{
    const {demo,consultar,criar,imagem,aviso}=window.conteudoCasa;if(demo)return;
    const host=document.querySelector('.galeria .fotos');if(!host)return;aviso(host,'Carregando fotos…');
    try{
        const fotos=(await consultar('galeria')).items.slice(0,3),divisao=criar('div','','divisao'),outras=criar('div');
        for(const [i,f] of fotos.entries()){const src=imagem(f.src);if(!src)continue;const img=criar('img');img.src=src;img.alt=f.alt;img.loading='lazy';(i===0?divisao:outras).append(img);}
        if(!divisao.childElementCount){aviso(host,'Ainda não há fotos publicadas.');return;}
        if(outras.childElementCount)divisao.append(outras);host.replaceChildren(divisao);
    }catch{aviso(host,'Fotos temporariamente indisponíveis.');}
})();
