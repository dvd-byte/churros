/* Renderiza os posts da fonte compartilhada e abre o artigo indicado pelo link. */
"use strict";
(async () => {
    const lista = document.querySelector(".listaPosts");
    if (!lista) return;
    let posts=window.postsBlog||[];
    if(!window.conteudoCasa.demo){
        document.querySelector('.avisoModelo')?.remove();
        window.conteudoCasa.aviso(lista,'Carregando publicações…');
        try{posts=(await window.conteudoCasa.consultar('blog')).items;}
        catch{window.conteudoCasa.aviso(lista,'Publicações temporariamente indisponíveis.');return;}
    }

    const criar = (tag, classe, texto) => {
        const elemento = document.createElement(tag);
        if (classe) elemento.className = classe;
        if (texto) elemento.textContent = texto;
        return elemento;
    };
    const fragmento = document.createDocumentFragment();
    posts.forEach((post, indice) => {
        const artigo = criar("article", indice === 0 ? "postagem postagemPrincipal" : "postagem");
        artigo.id = post.id;
        const imagem = criar("img");
        // Os dados usam caminhos a partir da raiz; o Blog fica em paginas/.
        const src=window.conteudoCasa.imagem(post.imagem);
        if(src)imagem.src=src;
        else imagem.hidden=true;
        imagem.alt = post.alt;
        imagem.loading = "lazy";
        const texto = criar("div", "textoPost");
        texto.append(criar("span", "subtitulo", post.categoria),
            criar("h2", "", post.titulo), criar("p", "", post.resumo));
        const detalhes = criar("details");
        const resumo = criar("summary", "", "Continuar lendo ");
        const seta = criar("span", "", "↗");
        seta.setAttribute("aria-hidden", "true");
        resumo.append(seta);
        const corpo = criar("div", "corpoPost");
        post.paragrafos.forEach((paragrafo) => corpo.append(criar("p", "", paragrafo)));
        const link = criar("a", "", post.textoLink);
        if(post.link)link.href = post.link;
        else link.hidden=true;
        if (post.link.startsWith("https://")) {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
        }
        corpo.append(link);
        if (window.conteudoCasa.demo && post.link.startsWith("https://www.ifood.com.br/")) {
            const link99 = criar("a", "", "Visitar a loja na 99 Food ↗");
            link99.href = "https://oia.99app.com/dlp9/KAuIUf?share_media=";
            link99.target = "_blank";
            link99.rel = "noopener noreferrer";
            corpo.append(link99);
        }
        detalhes.append(resumo, corpo);
        texto.append(detalhes);
        artigo.append(imagem, texto);
        fragmento.append(artigo);
    });
    lista.replaceChildren(fragmento);
    const total = document.querySelector(".totalPosts");
    if (total) total.textContent = posts.length + " postagens";
    if(!posts.length)window.conteudoCasa.aviso(lista,'Ainda não há publicações disponíveis.');

    const abrirPostIndicado = () => {
        let id;
        try { id = decodeURIComponent(window.location.hash.slice(1)); }
        catch { return; }
        const artigo = document.getElementById(id);
        if (!artigo?.matches(".postagem")) return;
        const detalhes = artigo.querySelector("details");
        if (detalhes) detalhes.open = true;
        artigo.scrollIntoView({ block: "start", behavior: "auto" });
    };
    window.addEventListener("hashchange", abrirPostIndicado);
    abrirPostIndicado();
})();

